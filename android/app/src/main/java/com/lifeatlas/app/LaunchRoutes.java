package com.lifeatlas.app;

import java.net.URI;

/** Small, platform-independent routing contract: no credentials, storage or app actions. */
public final class LaunchRoutes {
    private LaunchRoutes() {}
    public static String launcherRoute(String component) {
        if ("com.lifeatlas.app.FinanceLauncher".equals(component)) return "/secret/finance";
        if ("com.lifeatlas.app.MusicLauncher".equals(component)) return "/secret/music";
        if ("com.lifeatlas.app.GalleryLauncher".equals(component)) return "/secret/gallery";
        return null;
    }
    public static String safePrivateRoute(String route) {
        if (route == null || route.length() > 2048 || route.indexOf('\\') >= 0) return null;
        try {
            URI uri = new URI(route);
            if (uri.isAbsolute() || uri.getRawAuthority() != null || uri.getFragment() != null) return null;
            String path = uri.getPath();
            if (path == null || !path.matches("/secret(?:/[A-Za-z0-9_-]+)*")) return null;
            String query = uri.getRawQuery();
            if (query != null && !query.matches("[A-Za-z0-9_=&%.~-]*")) return null;
            return route;
        } catch (Exception ignored) { return null; }
    }
}
