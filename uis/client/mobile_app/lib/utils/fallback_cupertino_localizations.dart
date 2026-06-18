import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';

/// Fallback Cupertino localizations for unsupported locales
/// This provides default English text for Cupertino widgets when using
/// locales that don't have built-in support (like ig, yo, ha)
class FallbackCupertinoLocalizations implements CupertinoLocalizations {
  const FallbackCupertinoLocalizations();

  @override
  String get alertDialogLabel => 'Alert';

  @override
  String get anteMeridiemAbbreviation => 'AM';

  @override
  String get copyButtonLabel => 'Copy';

  @override
  String get cutButtonLabel => 'Cut';

  @override
  String datePickerYear(int yearIndex) => yearIndex.toString();

  @override
  String datePickerMonth(int monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex - 1];
  }

  @override
  String datePickerDayOfMonth(int dayIndex, [int? weekDay]) => dayIndex.toString();

  @override
  String datePickerHour(int hour) => hour.toString();

  @override
  String datePickerHourSemanticsLabel(int hour) => "$hour o'clock";

  @override
  String datePickerMinute(int minute) => minute.toString().padLeft(2, '0');

  @override
  String datePickerMinuteSemanticsLabel(int minute) {
    if (minute == 1) return '1 minute';
    return '$minute minutes';
  }

  @override
  String datePickerMediumDate(DateTime date) {
    return '${datePickerMonth(date.month)} ${date.day}, ${date.year}';
  }

  @override
  String datePickerStandaloneMonth(int monthIndex) => datePickerMonth(monthIndex);

  @override
  DatePickerDateOrder get datePickerDateOrder => DatePickerDateOrder.mdy;

  @override
  DatePickerDateTimeOrder get datePickerDateTimeOrder => DatePickerDateTimeOrder.date_time_dayPeriod;

  @override
  String get backButtonLabel => 'Back';

  @override
  String get cancelButtonLabel => 'Cancel';

  @override
  String get collapsedHint => 'Collapsed';

  @override
  String get expandedHint => 'Expanded';

  @override
  String get expansionTileCollapsedHint => 'double tap to expand';

  @override
  String get expansionTileCollapsedTapHint => 'Expand';

  @override
  String get expansionTileExpandedHint => 'double tap to collapse';

  @override
  String get expansionTileExpandedTapHint => 'Collapse';

  @override
  List<String> get timerPickerHourLabels => List<String>.generate(24, (int index) => (index % 12 == 0 ? 12 : index % 12).toString());

  @override
  List<String> get timerPickerMinuteLabels => List<String>.generate(60, (int index) => index.toString().padLeft(2, '0'));

  @override
  List<String> get timerPickerSecondLabels => List<String>.generate(60, (int index) => index.toString().padLeft(2, '0'));

  @override
  String get modalBarrierDismissLabel => 'Dismiss';

  @override
  String get pasteButtonLabel => 'Paste';

  @override
  String get postMeridiemAbbreviation => 'PM';

  @override
  String get searchTextFieldPlaceholderLabel => 'Search';

  @override
  String get selectAllButtonLabel => 'Select All';

  @override
  String tabSemanticsLabel({required int tabIndex, required int tabCount}) {
    return 'Tab $tabIndex of $tabCount';
  }

  @override
  String timerPickerHour(int hour) => hour.toString();

  @override
  String timerPickerMinute(int minute) => minute.toString();

  @override
  String timerPickerSecond(int second) => second.toString();

  @override
  String timerPickerHourLabel(int hour) => hour == 1 ? 'hour' : 'hours';

  @override
  String timerPickerMinuteLabel(int minute) => 'min';

  @override
  String timerPickerSecondLabel(int second) => 'sec';

  @override
  String get todayLabel => 'Today';

  @override
  String get noSpellCheckReplacementsLabel => 'No Replacements Found';

  @override
  String get lookUpButtonLabel => 'Look Up';

  @override
  String get menuDismissLabel => 'Dismiss menu';

  @override
  String get searchWebButtonLabel => 'Search Web';

  @override
  String get shareButtonLabel => 'Share...';

  @override
  String get clearButtonLabel => 'Clear';
}

/// Delegate for fallback Cupertino localizations
class FallbackCupertinoLocalizationsDelegate
    extends LocalizationsDelegate<CupertinoLocalizations> {
  const FallbackCupertinoLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    // Support all locales that aren't natively supported by Cupertino
    return true;
  }

  @override
  Future<CupertinoLocalizations> load(Locale locale) {
    return SynchronousFuture<CupertinoLocalizations>(
      const FallbackCupertinoLocalizations(),
    );
  }

  @override
  bool shouldReload(FallbackCupertinoLocalizationsDelegate old) => false;
}
