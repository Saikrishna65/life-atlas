package com.lifeatlas.app.wakeword.activation

import android.content.Context
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import android.os.Looper
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class AtlasActivationPreferencesTest {
    private val context: Context get() = RuntimeEnvironment.getApplication()
    @Before fun reset() {
        context.getSharedPreferences(AtlasActivationPreferences.FILE, Context.MODE_PRIVATE).edit().clear().commit()
        AtlasActivationRuntime.stopBridge()
    }
    @Test fun bridgeCannotBeArmedWithGenericWindowClasses() {
        assertTrue(AtlasActivationPreferences.observeOnly(context))
        assertFalse(AtlasActivationPreferences.consent(context))
        try {
            AtlasActivationPreferences.configure(context, false, "com.google.android.googlequicksearchbox", "android.widget.FrameLayout")
            fail("A generic framework window must not become an overlay trigger")
        } catch (_: IllegalArgumentException) { }
        assertTrue(AtlasActivationPreferences.observeOnly(context))
        AtlasActivationPreferences.configure(context, false, "com.google.android.googlequicksearchbox", "com.google.android.apps.gsa.synthetic.ObservedOverlay")
        assertFalse(AtlasActivationPreferences.observeOnly(context))
        AtlasActivationPreferences.configure(context, true, "", "")
        assertEquals("" to "", AtlasActivationPreferences.overlay(context))
    }
    @Test fun offCancelsAnUnconsumedActivationAndItsTimeout() {
        AtlasActivationPreferences.mode(context, AtlasActivationPreferences.GOOGLE)
        val token = AtlasActivationRuntime.prepareLaunch()
        assertTrue(AtlasActivationRuntime.valid(context, token))
        var completed = false
        AtlasActivationRuntime.switch(context, AtlasActivationPreferences.OFF) { error ->
            assertNull(error); completed = true
        }
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(completed)
        assertFalse(AtlasActivationRuntime.valid(context, token))
        assertNull(AtlasActivationRuntime.bridgeCoordinator)
        assertEquals(AtlasActivationPreferences.OFF, AtlasActivationPreferences.mode(context))
        val failures = AtlasActivationRuntime.status(context).getLong("failures")
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(16))
        assertEquals(failures, AtlasActivationRuntime.status(context).getLong("failures"))
    }
}
