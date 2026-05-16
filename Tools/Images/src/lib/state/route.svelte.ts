/**
 * Minimal hash router (first principles: 2 pages don't need a router dep).
 * Shareable URLs + working back button via `location.hash`.
 */
export type RouteId = "maker" | "tools";

const ROUTES: RouteId[] = ["maker", "tools"];

function parse(): RouteId {
  const h = location.hash.replace(/^#\/?/, "") as RouteId;
  return ROUTES.includes(h) ? h : "maker";
}

class RouteStore {
  current = $state<RouteId>("maker");

  init() {
    this.current = parse();
    addEventListener("hashchange", () => {
      this.current = parse();
    });
  }

  go(id: RouteId) {
    location.hash = `/${id}`;
  }
}

export const route = new RouteStore();
