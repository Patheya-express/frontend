# flight-helmet.glb — provenance and license

## Source

- Model: **FlightHelmet** ("USAAF A-11 Flying Helmet on a wooden stand with realistic high
  resolution textures")
- Publisher: Khronos Group, `KhronosGroup/glTF-Sample-Assets` repository
  (https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/FlightHelmet)
- Original source files retrieved 2026-08-19 from
  `Models/FlightHelmet/glTF/` at commit `main` (loose `.gltf` + `.bin` + 15 `.png` textures).
- Copyright: © 2018, Public. Creator credit: Gary Hsu (conversion from Maya).

## License

- Model files (geometry, textures, materials): **CC0-1.0 Universal** (public domain — no
  restrictions on use, modification, or redistribution), per the model's own
  `Models/FlightHelmet/LICENSE.md`.
- (Documentation/README text in the upstream repo is separately CC-BY-4.0; that text is not
  reproduced here and does not apply to the model itself.)
- A second sample model, **DamagedHelmet**, was initially considered but **rejected**: one source
  described it as CC-BY-NC (NonCommercial, unsuitable for this commercial codebase) while the
  repo's own `Models.md` table described it as plain CC-BY 4.0 — a genuine cross-source
  discrepancy that was not resolved with confidence, so it was not used. FlightHelmet's CC0-1.0
  status was independently confirmed directly from its own dedicated `LICENSE.md` file.

## Modifications made for this repository

The original asset (loose `.gltf` + `.bin` + 15 PNG textures, 46.15 MB total, 14 textures at
2048×2048 and 3 at 1024×1024) was **not** committed as-is — CC0-1.0 permits unrestricted
modification, so the following mobile-conscious, lossless-format changes were made before
packaging:

1. Every texture wider than 768px was downsampled to **768×768** (Lanczos resize via `sharp`).
   Textures already ≤768px (none, after the pass) were left untouched. This is a pure resolution
   reduction — no re-encoding to a lossy format, no GPU texture compression (no KTX2/Basis), no
   geometry compression (no Draco).
2. The resized loose glTF (`.gltf` + `.bin` + 15 resized `.png`) was packed into a single binary
   `.glb` container using `gltf-pipeline` (no Draco/KTX2 flags passed), so the runtime loads one
   file through the existing `AssetRegistry.loadFromUrl(url, 'container', …)` path — identical to
   `sample-triangle.glb` and `sample-textured.glb`, no loader changes required.

No geometry, materials, node hierarchy, or UVs were altered — only texture pixel dimensions and
file packaging changed.

## Resulting asset stats (`flight-helmet.glb`)

| Property | Value |
|---|---|
| File size | 14,476,144 bytes (~13.8 MiB / 14.48 MB) |
| Meshes | 6 (`Hose_low`, `RubberWood_low`, `GlassPlastic_low`, `MetalParts_low`, `LeatherParts_low`, `Lenses_low`) |
| Triangles | 94,722 total (19,680 / 24,178 / 8,136 / 20,096 / 21,896 / 736 per mesh above) |
| Materials | 6 (`HoseMat`, `RubberWoodMat`, `GlassPlasticMat`, `MetalPartsMat`, `LeatherPartsMat`, `LensesMat`) — all PBR metallic-roughness, each with base color + normal + occlusion/roughness/metallic packed textures except `HoseMat` (solid PBR values, no texture) |
| Textures / images | 15 PNG, all 768×768 after resize (uncompressed pixel data, PNG lossless container — no GPU texture compression) |
| glTF extensions used | `KHR_materials_transmission` (on `LensesMat`, the glass/lens material) — confirmed supported by the installed PlayCanvas build via its own `khr-materials-transmission` GLB parser extension (`node_modules/playcanvas/build/playcanvas/src/framework/parsers/glb/extensions/khr-materials-transmission.js`) |
| Compression | None (no Draco geometry compression, no KTX2/Basis texture compression) — deferred per the Phase 2.4 brief's "no premature optimization unless a concrete problem requires it"; texture downsampling alone was sufficient to land inside the ~5–20 MB target budget |
