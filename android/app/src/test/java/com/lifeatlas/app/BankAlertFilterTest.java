package com.lifeatlas.app;

/** Runs with plain javac/java, without an Android device or SDK. */
public final class BankAlertFilterTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError("Unexpected filter result"); }
    public static void main(String[] args) {
        String source = BankAlertFilter.GOOGLE_MESSAGES;
        check(BankAlertFilter.accepts(source, "VM-KOTAKB", "Rs. 500 debited from A/c XX1234 to SWIGGY. Ref 123456789012"));
        check(BankAlertFilter.accepts(source, "Bank", "Received INR 1000 in Kotak Bank A/c 1234 from ACME"));
        check(!BankAlertFilter.accepts("com.other.app", "VM-KOTAKB", "Rs. 500 debited"));
        check(!BankAlertFilter.accepts(source, "Friend", "I paid Rs 500 for dinner"));
        check(!BankAlertFilter.accepts(source, "KOTAKB", "OTP 123456. Rs 500 will be debited. Do not share."));
        check(!BankAlertFilter.accepts(source, "KOTAKB", "Your available balance is Rs 500"));
        check(!BankAlertFilter.accepts(source, "HDFCBK", "Rs 500 debited from A/c 1234"));
        check(!BankAlertFilter.accepts(source, "KOTAKB", "New message"));
        check(!BankAlertFilter.accepts(source, "KOTAKB", null));
        System.out.println("BankAlertFilter: 9 checks passed");
    }
}
