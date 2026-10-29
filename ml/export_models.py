"""Export trained LightGBM models as JSON trees for pure Node.js inference."""
import json
from pathlib import Path
import lightgbm as lgb

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "ml" / "artifacts"
count = 0
for model_path in ARTIFACTS.glob("*/*.txt"):
    booster = lgb.Booster(model_file=str(model_path))
    full = booster.dump_model()
    export = {
        "feature_names": full["feature_names"],
        "average_output": full["average_output"],
        "num_tree_per_iteration": full["num_tree_per_iteration"],
        "objective": full["objective"],
        "tree_info": full["tree_info"],
    }
    destination = model_path.with_suffix(".json")
    destination.write_text(json.dumps(export, separators=(",", ":")), encoding="utf-8")
    count += 1
print("Exported", count, "models for Node.js inference")
