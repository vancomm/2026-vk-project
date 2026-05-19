# ML-модель для улучшения изображений

![](ml.png)

## Try it out

https://vancommdot.com/vk

## Start locally

```sh
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