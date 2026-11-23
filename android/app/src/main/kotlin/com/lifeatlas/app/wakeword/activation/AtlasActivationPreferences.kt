package com.lifeatlas.app.wakeword.activation

import android.content.ComponentName
import android.content.Context
import android.provider.Settings

object AtlasActivationPreferences {
    const val FILE = "atlas_voice_activation"
    const val MICROPHONE = "microphone"
    const val GOOGLE = "google-bridge"
    const val OFF = "off"
    val GOOGLE_PACKAGES = setOf("com.google.android.googlequicksearchbox", "com.google.android.apps.bard")
    private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    // Preserve existing installations' manual-start listener behaviour; never auto-start here.
    fun mode(context: Context): String {
        val value = prefs(context).getString("mode", MICROPHONE)
        return if (value in setOf(MICROPHONE, GOOGLE, OFF)) value!! else OFF
    }
    fun mode(context: Context, value: String) {
        require(value in setOf(MICROPHONE, GOOGLE, OFF))
        check(prefs(context).edit().putString("mode", value).commit())
    }
    fun consent(context: Context) = prefs(context).getBoolean("disclosureV1", false)
    fun acknowledge(context: Context) { check(prefs(context).edit().putBoolean("disclosureV1", true).commit()) }
    fun observeOnly(context: Context) = prefs(context).getBoolean("observeOnly", true)
    fun overlay(context: Context): Pair<String, String> =
        (prefs(context).getString("package", "") ?: "") to (prefs(context).getString("class", "") ?: "")
    fun configure(context: Context, observeOnly: Boolean, pkg: String, cls: String) {
        require(observeOnly || (pkg in GOOGLE_PACKAGES && cls.startsWith("com.google.") &&
            cls.length in 8..240 && cls.matches(Regex("[A-Za-z0-9_.$]+")) &&
            !cls.startsWith("com.google.android.material."))) { "INVALID_OVERLAY_CLASS" }
        check(prefs(context).edit().putBoolean("observeOnly", observeOnly)
            .putString("package", if (observeOnly) "" else pkg)
            .putString("class", if (observeOnly) "" else cls).commit())
    }
    fun accessibilityEnabled(context: Context): Boolean {
        val expected = ComponentName(context, AtlasGoogleBridgeService::class.java)
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            ?.split(':')?.any { ComponentName.unflattenFromString(it) == expected } == true
    }
}
