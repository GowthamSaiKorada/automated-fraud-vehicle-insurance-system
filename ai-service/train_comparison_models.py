"""
Trains ResNet18, VGG16, MobileNetV2, and YOLOv8n-cls comparison models
on c:/Insurance/vehicle-insurance-fraud-detection/ai-service/dataset
and saves them into ./models/.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import torch
import torch.nn as nn
import torchvision.models as tv_models
from torch.utils.data import DataLoader, TensorDataset
from torchvision import datasets, transforms

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "dataset"
MODELS_DIR = BASE_DIR / "models"
os.environ.setdefault("TORCH_HOME", str(BASE_DIR / ".torch_cache"))
os.environ.setdefault("YOLO_CONFIG_DIR", str(BASE_DIR / ".ultralytics"))


def get_dataloaders(batch_size: int = 32):
    tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    train_ds = datasets.ImageFolder(DATA_DIR / "training", transform=tf)
    val_ds = datasets.ImageFolder(DATA_DIR / "validation", transform=tf)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    return train_ds, val_ds, train_loader, val_loader


@torch.inference_mode()
def extract_features(feature_fn, loader):
    feats, labels = [], []
    for imgs, lbls in loader:
        out = feature_fn(imgs)
        feats.append(torch.flatten(out, 1).cpu())
        labels.append(lbls.cpu())
    return torch.cat(feats, dim=0), torch.cat(labels, dim=0)


def train_head(head: nn.Module, train_x, train_y, val_x, val_y, epochs: int = 18, lr: float = 1e-3):
    ds = TensorDataset(train_x, train_y)
    loader = DataLoader(ds, batch_size=64, shuffle=True)
    opt = torch.optim.AdamW(head.parameters(), lr=lr, weight_decay=1e-4)
    crit = nn.CrossEntropyLoss()

    best_acc = 0.0
    best_state = None
    for _ in range(epochs):
        head.train()
        for bx, by in loader:
            opt.zero_grad()
            loss = crit(head(bx), by)
            loss.backward()
            opt.step()

        head.eval()
        with torch.inference_mode():
            preds = head(val_x).argmax(dim=1)
            acc = float((preds == val_y).float().mean().item())
        if acc >= best_acc:
            best_acc = acc
            best_state = {k: v.clone() for k, v in head.state_dict().items()}
    if best_state is not None:
        head.load_state_dict(best_state)
    return round(best_acc, 4)


def train_torchvision_models():
    train_ds, _, train_loader, val_loader = get_dataloaders(32)
    class_to_idx = train_ds.class_to_idx
    print("Dataset classes:", class_to_idx)

    # 1. ResNet18
    print("\n--- Training ResNet18 ---")
    resnet = tv_models.resnet18(weights=tv_models.ResNet18_Weights.DEFAULT)
    resnet.eval()
    rn_backbone = nn.Sequential(*list(resnet.children())[:-1])
    tr_x, tr_y = extract_features(rn_backbone, train_loader)
    va_x, va_y = extract_features(rn_backbone, val_loader)
    resnet.fc = nn.Linear(resnet.fc.in_features, 2)
    rn_acc = train_head(resnet.fc, tr_x, tr_y, va_x, va_y, epochs=25, lr=1e-3)
    torch.save(
        {
            "model_state_dict": resnet.state_dict(),
            "val_acc": rn_acc,
            "class_to_idx": class_to_idx,
            "backbone": "resnet18",
        },
        MODELS_DIR / "resnet18_damage.pth",
    )
    print(f"Saved resnet18_damage.pth | val_acc={rn_acc:.4f}")

    # 2. MobileNetV2
    print("\n--- Training MobileNetV2 ---")
    mn2 = tv_models.mobilenet_v2(weights=tv_models.MobileNet_V2_Weights.DEFAULT)
    mn2.eval()
    def mn2_feat(x):
        x = mn2.features(x)
        return nn.functional.adaptive_avg_pool2d(x, (1, 1))
    tr_x, tr_y = extract_features(mn2_feat, train_loader)
    va_x, va_y = extract_features(mn2_feat, val_loader)
    mn2.classifier[-1] = nn.Linear(mn2.classifier[-1].in_features, 2)
    mn2_acc = train_head(mn2.classifier, tr_x, tr_y, va_x, va_y, epochs=25, lr=1e-3)
    torch.save(
        {
            "model_state_dict": mn2.state_dict(),
            "val_acc": mn2_acc,
            "class_to_idx": class_to_idx,
            "backbone": "mobilenet_v2",
        },
        MODELS_DIR / "mobilenetv2_damage.pth",
    )
    print(f"Saved mobilenetv2_damage.pth | val_acc={mn2_acc:.4f}")

    # 3. VGG16 (train final 4096->2 head on fc7 features for fast CPU training with standard VGG16 architecture)
    print("\n--- Training VGG16 ---")
    vgg = tv_models.vgg16(weights=tv_models.VGG16_Weights.DEFAULT)
    vgg.eval()
    vgg_fc7 = nn.Sequential(*list(vgg.classifier.children())[:-1])
    def vgg_feat(x):
        x = vgg.features(x)
        x = vgg.avgpool(x)
        x = torch.flatten(x, 1)
        return vgg_fc7(x)
    tr_x, tr_y = extract_features(vgg_feat, train_loader)
    va_x, va_y = extract_features(vgg_feat, val_loader)
    vgg.classifier[-1] = nn.Linear(vgg.classifier[-1].in_features, 2)
    vgg_acc = train_head(vgg.classifier[-1], tr_x, tr_y, va_x, va_y, epochs=25, lr=1e-3)
    torch.save(
        {
            "model_state_dict": vgg.state_dict(),
            "val_acc": vgg_acc,
            "class_to_idx": class_to_idx,
            "backbone": "vgg16",
        },
        MODELS_DIR / "vgg16_damage.pth",
    )
    print(f"Saved vgg16_damage.pth | val_acc={vgg_acc:.4f}")


def train_yolo_classifier():
    print("\n--- Training YOLOv8n-cls ---")
    from ultralytics import YOLO

    yolo_data = BASE_DIR / ".yolo_cls_data"
    if yolo_data.exists():
        shutil.rmtree(yolo_data)
    for src_split, dst_split in [("training", "train"), ("validation", "val")]:
        for cls_dir in (DATA_DIR / src_split).iterdir():
            if not cls_dir.is_dir():
                continue
            target_dir = yolo_data / dst_split / cls_dir.name
            target_dir.mkdir(parents=True, exist_ok=True)
            for img_file in cls_dir.iterdir():
                if img_file.is_file():
                    os.link(img_file, target_dir / img_file.name)

    runs_dir = BASE_DIR / ".yolo_runs"
    if runs_dir.exists():
        shutil.rmtree(runs_dir)

    yolo = YOLO(str(MODELS_DIR / "yolov8n-cls.pt"))
    yolo.train(
        data=str(yolo_data),
        epochs=4,
        imgsz=224,
        batch=32,
        project=str(runs_dir),
        name="damage_cls",
        workers=0,
        verbose=True,
    )
    best_pt = runs_dir / "damage_cls" / "weights" / "best.pt"
    if best_pt.is_file():
        shutil.copy2(best_pt, MODELS_DIR / "yolo_cls.pt")
        print(f"Saved yolo_cls.pt from {best_pt}")

    shutil.rmtree(yolo_data, ignore_errors=True)
    shutil.rmtree(runs_dir, ignore_errors=True)


if __name__ == "__main__":
    if not (MODELS_DIR / "vgg16_damage.pth").is_file():
        if (MODELS_DIR / "resnet18_damage.pth").is_file() and (MODELS_DIR / "mobilenetv2_damage.pth").is_file():
            print("ResNet18 & MobileNetV2 already saved; running remaining VGG16 + YOLOv8n-cls...")
            train_ds, _, train_loader, val_loader = get_dataloaders(32)
            class_to_idx = train_ds.class_to_idx
            vgg = tv_models.vgg16(weights=tv_models.VGG16_Weights.DEFAULT)
            vgg.eval()
            vgg_fc7 = nn.Sequential(*list(vgg.classifier.children())[:-1])
            def vgg_feat(x):
                x = vgg.features(x)
                x = vgg.avgpool(x)
                x = torch.flatten(x, 1)
                return vgg_fc7(x)
            tr_x, tr_y = extract_features(vgg_feat, train_loader)
            va_x, va_y = extract_features(vgg_feat, val_loader)
            vgg.classifier[-1] = nn.Linear(vgg.classifier[-1].in_features, 2)
            vgg_acc = train_head(vgg.classifier[-1], tr_x, tr_y, va_x, va_y, epochs=25, lr=1e-3)
            torch.save(
                {
                    "model_state_dict": vgg.state_dict(),
                    "val_acc": vgg_acc,
                    "class_to_idx": class_to_idx,
                    "backbone": "vgg16",
                },
                MODELS_DIR / "vgg16_damage.pth",
            )
            print(f"Saved vgg16_damage.pth | val_acc={vgg_acc:.4f}")
        else:
            train_torchvision_models()
    if not (MODELS_DIR / "yolo_cls.pt").is_file():
        train_yolo_classifier()
    print("\nALL_COMPARISON_MODELS_TRAINED_OK")
