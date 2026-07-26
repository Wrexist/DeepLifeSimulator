# Character head models

Drop the raw export here as `head_raw.glb`, then:

    npm run head:list     # print the rig's real blendshape names
    npm run head:build    # produce the optimised head.glb

`morph-keep.json` is the list of blendshapes to KEEP. It currently holds the
app's own morph names (route B — artist-authored sculpting shapes). If your rig
uses different names, replace the contents with the names `head:list` prints.

`head:build` deliberately FAILS if the keep-list matches nothing, because a
total morph wipe makes the file smaller and therefore looks like a success.

Neither `head_raw.glb` nor `head.glb` is committed — see .gitignore. Raw exports
are large and are build inputs, not source.
