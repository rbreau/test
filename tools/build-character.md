# Building `assets/mathfinder.glb` from a Synty SIDEKICK package

1. Unpack the `.unitypackage` (it is a gzipped tar): every asset sits in a GUID folder with
   `asset` (the file) and `pathname` (its original path). Copy the `SK_*.fbx` parts and the
   `T_*ColorMap.png` palette textures out.
2. Pick a preset from the `*.sk` files (a YAML list of part names + which color map it uses).
3. In a browser with Three.js r128 + FBXLoader + GLTFExporter (see the session's
   `buildchar.html` approach): load each part, take the first part's bone hierarchy as the master
   skeleton, and for every other part rebuild its Skeleton from master bones matched by name
   (grafting any attachment-only bones such as `abac_dyn_*` onto their same-named parent), then
   `mesh.bind(skeleton, bindMatrix)`. Give all meshes one MeshStandardMaterial with the palette
   texture (`flipY = true`, nearest filtering, sRGB). Rotate the root so the eyes face +Z, scale
   by 0.01 (cm → m), export binary glTF.
4. Drop hidden parts (teeth, tongue) and any bulky attachments you do not want; the Starter_02
   build weighs ~7.8 MB with the backpack and pouches.

Bone names the runtime animator expects: pelvis, spine_02/03, neck_01, head, upperarm_l/r,
lowerarm_l/r, hand_l/r, thigh_l/r, calf_l/r, foot_l/r (standard Synty / UE naming).
