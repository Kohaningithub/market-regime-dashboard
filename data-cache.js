(() => {
  let manifestPromise;

  async function manifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(`data/asset_manifest.json?t=${Date.now()}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { assets: {} }))
        .catch(() => ({ assets: {} }));
    }
    return manifestPromise;
  }

  window.dashboardDataUrl = async (path) => {
    const assets = (await manifest()).assets || {};
    const version = assets[path];
    return version ? `${path}${path.includes("?") ? "&" : "?"}v=${version}` : path;
  };
  window.dashboardDataFetch = async (path, options = {}) =>
    fetch(await window.dashboardDataUrl(path), { cache: "default", ...options });
})();
