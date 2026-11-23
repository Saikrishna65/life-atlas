// Shared by every packaged lazy entry. Keep this independent of React so styles
// finish before React.lazy resolves, including when a screen is opened offline.
const pending = new Map();
export function loadStyles(urls) {
  return Promise.all(
    urls.map((url) => {
      if (pending.has(url)) return pending.get(url);
      const ready = new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.onload = () => resolve();
        link.onerror = () => {
          pending.delete(url);
          link.remove();
          reject(
            new Error("Could not open this screen’s styles. Please try again."),
          );
        };
        document.head.append(link);
      });
      pending.set(url, ready);
      return ready;
    }),
  );
}
