package com.lifeatlas.app;

import java.util.regex.Pattern;

/** Filters before persistence: only Kotak transaction alerts from Google Messages. */
final class BankAlertFilter {
    static final String GOOGLE_MESSAGES = "com.google.android.apps.messaging";
    private static final Pattern BANK = Pattern.compile("kotak", Pattern.CASE_INSENSITIVE);
    private static final Pattern SECRET = Pattern.compile("\\b(otp|one[ -]time password|verification code|secret code|do not share)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIRECTION = Pattern.compile("\\b(debited|credited|debit|credit|sent|received|paid|spent|withdrawn|refund)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT = Pattern.compile("(?:Rs\\.?|INR|₹)\\s*[0-9]", Pattern.CASE_INSENSITIVE);

    static boolean accepts(String packageName, String sender, String text) {
        if (!GOOGLE_MESSAGES.equals(packageName) || text == null || text.length() > 20000) return false;
        String combined = (sender == null ? "" : sender) + " " + text;
        return BANK.matcher(combined).find() && !SECRET.matcher(combined).find()
            && DIRECTION.matcher(text).find() && AMOUNT.matcher(text).find();
    }
}
