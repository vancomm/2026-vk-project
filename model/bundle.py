import os
import sys
from pathlib import Path

import torch
from huggingface_hub import hf_hub_download


REPO_ID = "IanNathaniel/Zero-DCE"
EXPORT_PATH = "dist/zero_dce.onnx"

print(f"downloading {REPO_ID} from Hugging Face...")
try:
    model_file_path = hf_hub_download(repo_id=REPO_ID, filename="model.py", repo_type="space")
    weights_file_path = hf_hub_download(repo_id=REPO_ID, filename="Epoch99.pth", repo_type="space")
except Exception as e:
    print(f"loading failed: {e}")
    sys.exit(1)

print("evaluating loaded model...")
try:
    model_dir = os.path.dirname(model_file_path)
    sys.path.append(model_dir)

    import model

    device = torch.device("cpu")
    net = model.enhance_net_nopool().to(device) # type: ignore
    net.load_state_dict(torch.load(weights_file_path, map_location=device))
    net.eval()
except Exception as e:
    print(f"evaluation failed: {e}")
    sys.exit(1)

print("exporting model...")
try:
    export_dir =  Path(EXPORT_PATH).parent
    if not export_dir.exists():
        export_dir.mkdir()

    dummy_input = torch.randn(1, 3, 256, 256, device=device)

    torch.onnx.export(
        net,
        dummy_input, # type: ignore
        EXPORT_PATH,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=['input_image'],
        output_names=['enhanced_image_mid', 'enhanced_image_final', 'curves'],
        dynamic_axes=None,
        external_data=False,
    )
except Exception as e:
    print(f"export failed: {e}")
    sys.exit(1)

print("success!")
