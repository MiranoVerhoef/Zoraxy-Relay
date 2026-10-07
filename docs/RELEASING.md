# Stable releases

1. Prepare a release branch with matching `.introspect`, plugin/client versions, UI cache keys, `directories/index2.json`, and changelog. Keep `.releaseurl` pointed at `releases/latest/download` and generated connector images on `:latest`.
2. Open a pull request to `main` and wait for CI and manual testing to pass, then merge it.
3. Create a new version tag on the merged commit and publish a stable GitHub release for that tag, for example `v2.0.1`. Publishing the release starts the Release workflow. Creating a draft, pushing a tag, editing release notes, or pushing branch changes does not start a release build.
4. Wait for the workflow to upload all fourteen plugin/client binaries and publish the Docker `:latest` and version tags for Linux AMD64 and ARM64. Check the release assets and store downloads before announcing availability.

The workflow verifies that the release tag matches `.introspect` and points to a commit merged into `main`. Prereleases are skipped. Failed workflow runs can be rerun against the same release; they rebuild the same tagged source and replace its assets.

CI validates code and metadata on pull requests and `main`; documentation-only changes are skipped. CI never creates a release or publishes images.

Beta development will use a separate repository. This repository no longer maintains a beta workflow or store index. Existing beta installations at numeric version 2.0.1 need a manual executable replacement to switch to stable v2.0.1 because Zoraxy compares numeric version fields only. Preserve the plugin's persistent files, switch the community source to the stable index, and change beta Docker connector images to `:latest`.
