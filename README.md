# ML-модель для улучшения изображений

![](ml.png)

```
# bundle ML model
cd model
uv sync
uv run bundle.py
cp dist/* ../frontend/public/models

# install and run demo
cd ../frontend
pnpm ci
pnpm run dev
```