import com.lifeatlas.app.LaunchRoutes;
import java.util.Objects;

/** Platform-independent native routing contract; not an Android app build. */
public class LaunchRoutesCheck {
    private static void equal(Object actual, Object expected) {
        if (!Objects.equals(actual, expected)) throw new AssertionError(actual + " != " + expected);
    }
    public static void main(String[] args) {
        for (String name : new String[]{"Finance", "Music", "Gallery"}) {
            equal(LaunchRoutes.launcherRoute("com.lifeatlas.app." + name + "Launcher"), "/secret/" + name.toLowerCase());
        }
        equal(LaunchRoutes.launcherRoute("com.other.app.FinanceLauncher"), null);
        for (String invalid : new String[]{"//evil.test/secret", "https://evil.test/secret", "/secretary", "/secret/../admin", "/secret/%2e%2e/admin", "/secret\\music", "/secret#x", "/secret?x=1?y=2", "/secret?x='script'", "/secret/%", "/secret\n"}) {
            equal(LaunchRoutes.safePrivateRoute(invalid), null);
        }
        equal(LaunchRoutes.safePrivateRoute(null), null);
        equal(LaunchRoutes.safePrivateRoute("/secret/finance?review=1&event=gmsg_abc"), "/secret/finance?review=1&event=gmsg_abc");
        System.out.println("PASS: native launcher mapping and safe route contract");
    }
}
