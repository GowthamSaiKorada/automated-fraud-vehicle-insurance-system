"""
Training utility for VehicleForensicCNN.

Expected dataset directory layout:
  dataset/
    train/
      authentic/
      suspicious/
    val/
      authentic/
      suspicious/

Example usage:
  python train_model.py --data-dir ./dataset --epochs 15 --output ./models/forensic_cnn.pth
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from app.model import VehicleForensicCNN, build_mobilenet_classifier


def train(
    data_dir: Path,
    epochs: int,
    batch_size: int,
    lr: float,
    output_path: Path,
    backbone: str = "mobilenet_v3_small",
) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.1, contrast=0.1),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    train_dir = data_dir / "training" if (data_dir / "training").is_dir() else data_dir / "train"
    val_dir = data_dir / "validation" if (data_dir / "validation").is_dir() else data_dir / "val"

    train_ds = datasets.ImageFolder(train_dir, transform=train_tf)
    val_ds = datasets.ImageFolder(val_dir, transform=val_tf)
    print(f"Train dir: {train_dir} ({len(train_ds)} images) | Val dir: {val_dir} ({len(val_ds)} images)")
    print(f"Class mapping: {train_ds.class_to_idx} (index 0 -> AUTHENTIC, index 1 -> SUSPICIOUS)")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    if backbone == "mobilenet_v3_small":
        model = build_mobilenet_classifier(num_classes=2, pretrained=True).to(device)
    else:
        model = VehicleForensicCNN(num_classes=2).to(device)
    print(f"Training backbone={backbone} on device={device}")
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    best_acc = 0.0
    output_path.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)

        model.eval()
        correct = 0
        total = 0
        with torch.inference_mode():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                preds = model(images).argmax(dim=1)
                correct += int((preds == labels).sum().item())
                total += labels.size(0)

        val_acc = correct / max(total, 1)
        print(f"Epoch {epoch}/{epochs} | train_loss={running_loss / len(train_ds):.4f} | val_acc={val_acc:.4f}")

        if val_acc >= best_acc:
            best_acc = val_acc
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "val_acc": val_acc,
                    "class_to_idx": train_ds.class_to_idx,
                    "backbone": backbone,
                },
                output_path,
            )
            print(f"Saved checkpoint to {output_path} (val_acc={val_acc:.4f})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train VehicleForensicCNN")
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--backbone", type=str, default="mobilenet_v3_small", choices=["mobilenet_v3_small", "custom"])
    parser.add_argument("--output", type=Path, default=Path("models/forensic_cnn.pth"))
    args = parser.parse_args()
    train(args.data_dir, args.epochs, args.batch_size, args.lr, args.output, args.backbone)
