# R11 publication evidence — partial gate

The earlier “not deployed” observation is superseded by this publication check.
R11 remains blocked on provider/operator facts, ASC answers and visual/native
acceptance. Publication does not verify those requirements.

- Source: `c32f2b9a395ce9f617c5f80f08a0a59d2c0f6883`, merged PR #203.
- [Pages deployment 34337850444](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34337850444)
  completed successfully on 9 September 2026.
- Direct HTTP requests with `Cache-Control: no-cache` returned 200 for both files;
  each response body matched the corresponding merged source file byte-for-byte.
- [Privacy](https://wrexist.github.io/DeepLifeSimulator/privacy.html): SHA-256
  `06e71344a73c249e272dd48921afd5ae5437cbb384f0d6c5d16044af3b290d92`.
- [Support](https://wrexist.github.io/DeepLifeSimulator/support.html): SHA-256
  `abc7cca7aee08af1e98027c7e071e21c9f8182238d5aab28ce13602436dffc5f`.

The web lookup returned an older cached copy; it was not used as publication
proof. Browser tab discovery still timed out after the documented connection
check, so no visual pass is recorded. Current local ASC status still lacks its
credentials; those values may exist in GitHub's production environment. The
existing ASC workflow has a read-only `plan` mode, but this session exposes no
workflow-dispatch tool or authenticated local CLI to run it. Do not copy private
keys into task evidence or add an automatic store mutation to get around that gap.
