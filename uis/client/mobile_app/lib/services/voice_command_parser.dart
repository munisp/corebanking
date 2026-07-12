enum VoiceCommandType {
  checkBalance,
  transfer,
  payBill,
  viewTransactions,
  applyLoan,
  openSavings,
  viewLpos,
  viewAgriculture,
  viewInsurance,
  viewBankStatement,
  viewCarbonCredits,
  viewCards,
  viewEscrow,
  viewMortgage,
  viewEducation,
  viewEsusu,
  viewVirtualAccounts,
  help,
  unknown,
}

class VoiceCommand {
  final VoiceCommandType type;
  final Map<String, dynamic> parameters;
  final String originalText;
  final double confidence;

  VoiceCommand({
    required this.type,
    required this.parameters,
    required this.originalText,
    this.confidence = 0.0,
  });

  @override
  String toString() {
    return 'VoiceCommand(type: $type, parameters: $parameters, confidence: $confidence)';
  }
}

class VoiceCommandParser {
  // Supported locales
  static const _localeMap = {
    'en-NG': 'en',
    'yo-NG': 'yo',
    'ig-NG': 'ig',
    'ha-NG': 'ha',
  };

  // IMPORTANT: Patterns are now more flexible with word boundaries
  static const Map<String, Map<String, List<String>>> _patterns = {
    'en': {
      'balance': [
        'check balance', 'what is my balance', 'show balance', 'account balance', 
        'my balance', 'check my account', 'balance', 'check account',
      ],
      'transfer': [
        'transfer', 'send money', 'send', 'pay to', 'send funds', 'make transfer',
        'i want to transfer', 'i want to send',
      ],
      'bill': [
        'pay bill', 'pay my bill', 'electricity bill', 'water bill', 
        'internet bill', 'phone bill', 'bill payment', 'pay electricity',
        'pay water', 'pay internet', 'pay phone',
      ],
      'transactions': [
        'show my transactions', 'view recent transactions', 'transaction history', 
        'show transactions', 'my transactions', 'recent transactions', 'view transactions',
      ],
      'loan': [
        'apply for a loan', 'i need a loan', 'loan application', 
        'loan', 'get a loan', 'request loan', 'apply for loan',
      ],
      'savings': [
        'view savings', 'savings', 'my savings', 'check savings', 'savings account',
        'show savings',
      ],
      'lpos': [
        'lpo', 'local purchase order', 'purchase order', 'view lpo', 'my lpos',
        'show lpos', 'check lpo', 'lpo application',
      ],
      'agriculture': [
        'agriculture', 'agriculture banking', 'farming', 'agric loan', 'farm loan',
        'agriculture loan', 'view agriculture', 'agric banking',
      ],
      'insurance': [
        'insurance', 'my insurance', 'view insurance', 'insurance policy',
        'check insurance', 'show insurance',
      ],
      'bank_statement': [
        'bank statement', 'statement', 'account statement', 'view statement',
        'show statement', 'download statement', 'get statement',
      ],
      'carbon_credits': [
        'carbon credits', 'carbon', 'environmental credits', 'green credits',
        'view carbon credits', 'my carbon credits',
      ],
      'cards': [
        'cards', 'my cards', 'debit card', 'credit card', 'view cards',
        'show cards', 'check cards', 'card',
      ],
      'escrow': [
        'escrow', 'escrow account', 'view escrow', 'my escrow',
        'check escrow', 'show escrow',
      ],
      'mortgage': [
        'mortgage', 'home loan', 'housing loan', 'mortgage loan',
        'view mortgage', 'my mortgage', 'apply for mortgage',
      ],
      'education': [
        'education', 'education loan', 'student loan', 'school fees',
        'education banking', 'view education', 'education finance',
      ],
      'esusu': [
        'esusu', 'thrift', 'contribution', 'esusu account',
        'view esusu', 'my esusu', 'savings group',
      ],
      'virtual_accounts': [
        'virtual account', 'virtual accounts', 'sub account', 'sub accounts',
        'view virtual accounts', 'my virtual accounts', 'collection account',
      ],
      'help': [
        'help', 'what can you do', 'how to use', 'commands', 
        'what can i say', 'assist me', 'assistance',
      ],
    },
    'yo': {
      'balance': [
        'sayewo iwontunwonsi', 'ṣayẹwo iwontunwonsi',
        'kini iwontunwonsi', 'iwontunwonsi akọọlẹ', 'iwontunwonsi akoole',
        'iwontunwonsi mi', 'sayewo akoole mi', 'ṣayẹwo akọọlẹ mi',
        'wo iwontunwonsi', 'iwontunwonsi', 'akoole mi', 'akọọlẹ mi',
      ],
      'transfer': [
        // Most common variations first
        'mo fe sanwo', 'mo fẹ sanwo', 'mo fe fi owo', 'mo fẹ fi owo',
        'firanṣẹ', 'firanṣe', 'firansẹ', 'firanse',
        'sanwo', 'fi owo ransẹ', 'fi owo ranse', 'fi owo ranṣẹ',
        'mo fe fi owo ransẹ', 'mo fẹ fi owo ransẹ',
        'mo fe fi owo ranse', 'mo fẹ fi owo ranse', 
        'mo fe firansẹ', 'mo fẹ firansẹ', 'mo fe firanṣẹ', 'mo fẹ firanṣẹ',
        'mo fe transfer', 'mo fẹ transfer',
        'ran owo', 'ransẹ owo', 'ranṣẹ owo',
        // Variations with "fe" vs "fẹ"
        'mofesanwo', 'mofẹsanwo', // In case speech recognition removes spaces
      ],
      'bill': [
        'sanwo fun ina', 'sanwo ina', 'san owo ina',
        'sanwo fun omi', 'sanwo omi', 'san owo omi',
        'sanwo fun internet', 'sanwo internet', 'san owo internet',
        'sanwo fun foonu', 'sanwo foonu', 'san owo foonu', 'sanwo phone',
        'san owo', 'sanwo fun', 'san',
      ],
      'transactions': [
        'fi awọn iṣowo han', 'fi awon isowo han',
        'ṣe afihan iṣowo', 'se afihan isowo',
        'wo iṣowo', 'wo isowo', 'iṣowo mi', 'isowo mi',
        'itan iṣowo', 'itan isowo', 'isowo',
      ],
      'loan': [
        'bere awin', 'beere awin', 'mo nilo awin', 'awin',
        'mo fe gba awin', 'mo fẹ gba awin',
        'se awin', 'ṣe awin',
      ],
      'savings': [
        'wo fipamọ', 'wo fipamo', 'fipamọ', 'fipamo',
        'ifowopamọ', 'ifowopamo', 'wo ifowopamọ', 'wo ifowopamo',
        'akaunt fipamọ', 'akaunt fipamo',
      ],
      'lpos': [
        'lpo', 'asẹ rira', 'ase rira', 'wo lpo', 'lpo mi',
        'fi awọn lpo han', 'fi awon lpo han',
      ],
      'agriculture': [
        'ọgbin', 'ogbin', 'banki ọgbin', 'banki ogbin', 'iṣẹ ọgbin', 'ise ogbin',
        'awin ọgbin', 'awin ogbin', 'wo ọgbin', 'wo ogbin',
      ],
      'insurance': [
        'iṣeduro', 'iseduro', 'iṣeduro mi', 'iseduro mi', 'wo iṣeduro', 'wo iseduro',
      ],
      'bank_statement': [
        'alaye banki', 'alaye akaunt', 'wo alaye', 'fi alaye han',
      ],
      'carbon_credits': [
        'kirẹditi erogba', 'krediti erogba', 'carbon credits', 'wo kirẹditi',
      ],
      'cards': [
        'kaadi', 'awọn kaadi', 'awon kaadi', 'kaadi mi', 'wo kaadi',
      ],
      'escrow': [
        'escrow', 'akaunt escrow', 'wo escrow',
      ],
      'mortgage': [
        'awin ile', 'awin ilé', 'ile awin', 'wo awin ile',
      ],
      'education': [
        'ẹkọ', 'eko', 'awin ẹkọ', 'awin eko', 'banki ẹkọ', 'banki eko',
        'owo ile-iwe', 'owo ile iwe',
      ],
      'esusu': [
        'esusu', 'ajo', 'ajọ', 'wo esusu', 'esusu mi',
      ],
      'virtual_accounts': [
        'akaunt foju', 'awọn akaunt foju', 'awon akaunt foju', 'wo akaunt foju',
      ],
      'help': [
        'iranlọwọ', 'iranlowo', 'ṣe iranlọwọ', 'se iranlowo',
        'kí ni o le ṣe', 'ki ni o le se', 'bawo ni mo ṣe le lo', 'bawo ni mo se le lo',
        'ran mi lọwọ', 'ran mi lowo', 'egbe mi',
      ],
    },
    'ig': {
      'balance': [
        'lelee nguzozi', 'lee nguzozi', 'lee ego', 'lelee ego',
        'gịnị bụ nguzozi', 'gini bu nguzozi', 'kedu nguzozi',
        'nguzozi akaụntụ', 'nguzozi akauntu', 'nguzozi m',
        'lelee akaụntụ m', 'lee akauntu m', 'akaụntụ m', 'akauntu m',
        'nguzozi', 'ego m', 'chekwa ego m',
      ],
      'transfer': [
        'zipu', 'ziga', 'zitere', 'zite ego',
        'nyefee', 'nyefe ego', 'nye ego',
        'ziga ego', 'zipu ego', 'zitere ego',
        'achọrọ m izipu ego', 'achoro m izipu ego',
        'achọrọ m iziga ego', 'achoro m iziga ego',
        'm ga-eziga ego', 'm ga eziga ego', 'm ga ziga ego',
        'transfer', 'nyefe',
      ],
      'bill': [
        'kwụọ ụgwọ ọkụ', 'kwuo ugwo oku', 'kwụọ ọkụ', 'kwuo oku',
        'kwụọ ụgwọ mmiri', 'kwuo ugwo mmiri', 'kwụọ mmiri', 'kwuo mmiri',
        'kwụọ ụgwọ internet', 'kwuo ugwo internet', 'kwụọ internet', 'kwuo internet',
        'kwụọ ụgwọ ekwentị', 'kwuo ugwo ekwenti', 'kwụọ ekwentị', 'kwuo ekwenti',
        'kwụọ ụgwọ phone', 'kwuo ugwo phone',
        'kwụọ ụgwọ', 'kwuo ugwo', 'akwụ ụgwọ', 'akwu ugwo',
      ],
      'transactions': [
        'gosi m azụmahịa', 'gosi m azumahia', 'gosipụta azụmahịa', 'gosiputa azumahia',
        'lee azụmahịa', 'lee azumahia', 'lelee azụmahịa', 'lelee azumahia',
        'akụkọ azụmahịa', 'akuko azumahia', 'ihe m mere', 'ọrụ azụmahịa', 'oru azumahia',
        'azụmahịa m', 'azumahia m',
      ],
      'loan': [
        'rịọ maka mgbazinye', 'rio maka mgbazinye', 'chọọ mgbazinye', 'choo mgbazinye',
        'achọrọ m mgbazinye', 'achoro m mgbazinye', 'mgbazinye',
        'ego mgbazinye', 'nweta mgbazinye', 'loan',
        'm chọrọ mgbazinye', 'm choro mgbazinye',
      ],
      'savings': [
        'lee nchekwa', 'lelee nchekwa', 'nchekwa',
        'ego nchekwa', 'nchekwa ego', 'lee nchekwa m', 'lelee nchekwa m',
        'akaụntụ nchekwa', 'akauntu nchekwa', 'nchekwa m',
      ],
      'lpos': [
        'lpo', 'iwu ịzụta', 'iwu izuta', 'lee lpo', 'lpo m',
        'gosipụta lpo', 'gosiputa lpo',
      ],
      'agriculture': [
        'ọrụ ugbo', 'oru ugbo', 'ụlọ akụ ọrụ ugbo', 'ulo aku oru ugbo',
        'mgbazinye ọrụ ugbo', 'mgbazinye oru ugbo', 'lee ọrụ ugbo',
      ],
      'insurance': [
        'mkpuchi', 'mkpuchi m', 'lee mkpuchi', 'gosipụta mkpuchi',
      ],
      'bank_statement': [
        'nkọwa ụlọ akụ', 'nkowa ulo aku', 'nkọwa akaụntụ', 'lee nkọwa',
      ],
      'carbon_credits': [
        'kredit carbon', 'carbon credits', 'lee kredit carbon',
      ],
      'cards': [
        'kaadị', 'kaadi', 'kaadị m', 'kaadi m', 'lee kaadị', 'lee kaadi',
      ],
      'escrow': [
        'escrow', 'akaụntụ escrow', 'akauntu escrow', 'lee escrow',
      ],
      'mortgage': [
        'mgbazinye ụlọ', 'mgbazinye ulo', 'ụlọ mgbazinye', 'lee mgbazinye ụlọ',
      ],
      'education': [
        'agụmakwụkwọ', 'agumakwukwo', 'mgbazinye agụmakwụkwọ',
        'ụlọ akụ agụmakwụkwọ', 'ulo aku agumakwukwo', 'ego akwụkwọ',
      ],
      'esusu': [
        'esusu', 'otu nchekwa', 'lee esusu', 'esusu m',
      ],
      'virtual_accounts': [
        'akaụntụ nke mbara', 'akauntu nke mbara', 'lee akaụntụ nke mbara',
      ],
      'help': [
        'enyemaka', 'nyere m aka', 'nyere aka',
        'kedụ ihe ị nwere ike ime', 'kedu ihe i nwere ike ime',
        'otú esi eji', 'otu esi eji', 'kụziere m', 'kuziere m',
        'gịnị ka ị nwere ike ime', 'gini ka i nwere ike ime',
        'nyere m enyemaka',
      ],
    },
    'ha': {
      'balance': [
        'duba ragowar kudi', 'duba ragowar', 'ragowar kudi',
        'mene ne ragowar', 'menene ragowar',
        'ragowar asusu', 'ragowar asusuna', 'ragowar kudi na',
        'duba asusu na', 'duba asusuna', 'nuna ragowar',
        'ragowar', 'kudin da nake da shi', 'kudi na',
      ],
      'transfer': [
        'tura', 'tura kudi', 'aika kudi', 'aika',
        'so in tura kudi', 'so in aika kudi', 'ina son tura kudi', 'ina son aika kudi',
        'zan tura kudi', 'zan aika kudi', 'in tura', 'in aika',
        'aikawa kudi', 'transfer', 'canja kudi',
      ],
      'bill': [
        'biya kudin wuta', 'biya wuta', 'kudin wuta', 'tura kudin wuta',
        'biya kudin ruwa', 'biya ruwa', 'kudin ruwa', 'tura kudin ruwa',
        'biya kudin internet', 'biya internet', 'kudin internet', 'tura kudin internet',
        'biya kudin waya', 'biya waya', 'kudin waya', 'tura kudin waya',
        'biya kudin phone', 'biya phone',
        'biya kudi', 'biya bashi', 'kudin',
      ],
      'transactions': [
        "nuna min ma'amaloli", "nuna ma'amaloli", "duba ma'amaloli",
        "duba sabbin ma'amaloli", "nuna sabbin ma'amaloli",
        "tarihin ma'amaloli", "ma'amalotin da na yi", "ma'amaloli na",
        "ma'amaloli", "abubuwan da na yi",
      ],
      'loan': [
        'nemi aron', 'nema aron', 'ina bukatar aro', 'ina bukatar aron',
        'aro', 'aron', 'ina son aro', 'ina son aron',
        'so in samu aro', 'so in samu aron', 'loan', 'karbar bashi',
      ],
      'savings': [
        'duba ajiya', 'nuna ajiya', 'ajiya',
        'ajiyan kudi', 'ajiya ta', 'ajiya na', 'duba ajiyar kudi',
        'asusun ajiya', 'kudin ajiya',
      ],
      'lpos': [
        'lpo', 'umarnin saye', 'duba lpo', 'lpo na',
        'nuna lpo',
      ],
      'agriculture': [
        'noma', 'bankin noma', 'aikin gona', 'aron noma',
        'duba noma', 'nuna noma',
      ],
      'insurance': [
        'inshora', 'inshora ta', 'duba inshora', 'nuna inshora',
      ],
      'bank_statement': [
        'bayanan banki', 'bayanan asusu', 'duba bayanan', 'nuna bayanan',
      ],
      'carbon_credits': [
        'credit carbon', 'carbon credits', 'duba credit carbon',
      ],
      'cards': [
        'katunan', 'katuna', 'katunan na', 'katuna na', 'duba katunan',
      ],
      'escrow': [
        'escrow', 'asusun escrow', 'duba escrow',
      ],
      'mortgage': [
        'lamunin gida', 'aron gida', 'duba lamunin gida',
      ],
      'education': [
        'ilimi', 'aron ilimi', 'bankin ilimi', 'kudin makaranta',
        'duba ilimi',
      ],
      'esusu': [
        'esusu', 'ajiya tare', 'duba esusu', 'esusu na',
      ],
      'virtual_accounts': [
        'asusun kama-da-wane', 'virtual account', 'duba asusun kama-da-wane',
      ],
      'help': [
        'taimako', 'yi mini taimako', 'ba ni taimako',
        'me zaka iya yi', 'me za ka iya yi', 'me kake iya yi',
        'yadda ake amfani', 'yadda ake amfani da shi', 'koya mini',
        'taimaka mini', 'neman taimako',
      ],
    },
  };

  static const Map<String, String> _helpText = {
    'en': '''
Available commands:
- Transfer: "Transfer 1000 to account 1234567890"
- View transactions: "Show my transactions"
- Apply for loan: "I need a loan"
- View savings: "View savings"
- View LPO: "Show my LPO"
- Agriculture banking: "Open agriculture banking"
- Insurance: "View my insurance"
- Bank statement: "Download bank statement"
- Carbon credits: "Show carbon credits"
- Cards: "View my cards"
- Escrow: "Open escrow"
- Mortgage: "View mortgage"
- Education: "Education banking"
- Esusu: "View esusu"
- Help: "Help"
''',
    'yo': '''
Awọn aṣẹ to wa:
- Firanṣẹ/Sanwo: "Mo fe sanwo" or "Firanṣẹ 1000"
- Wo awọn iṣowo: "Wo isowo mi"
- Beere awin: "Mo nilo awin"
- Wo fipamọ: "Wo fipamọ"
- Wo LPO: "Ṣii LPO mi"
- Owo ọgbin: "Ṣii ifowopamọ ọgbin"
- Idabobo: "Wo idabobo mi"
- Akọọlẹ banki: "Ṣii akọọlẹ banki"
- Epo carbon: "Wo epo carbon"
- Kaadi: "Wo awọn kaadi mi"
- Escrow: "Ṣii escrow"
- Mortgage: "Wo mortgage"
- Eto ẹkọ: "Ifowopamọ eto ẹkọ"
- Esusu: "Wo esusu"
- Iranlọwọ: "Iranlọwọ"
''',
    'ig': '''
Iwu dị:
- Zipu: "Zipu 1000"
- Lee azụmahịa: "Gosi m azumahia"
- Rịọ mgbazinye: "Achoro m mgbazinye"
- Lee nchekwa: "Lee nchekwa"
- Lee LPO: "Gosi LPO m"
- Ọrụ ugbo: "Mepe banking ọrụ ugbo"
- Mkpuchi: "Lee mkpuchi m"
- Akwụkwọ bank: "Budata akwụkwọ bank"
- Carbon credits: "Gosi carbon credits"
- Kaadị: "Lee kaadị m"
- Escrow: "Mepe escrow"
- Mortgage: "Lee mortgage"
- Agụmakwụkwọ: "Banking agụmakwụkwọ"
- Esusu: "Lee esusu"
- Enyemaka: "Enyemaka"
''',
    'ha': '''
Umarnin da ake da su:
- Tura: "Tura 1000"
- Duba ma'amaloli: "Nuna min ma'amaloli"
- Nemi aro: "Ina bukatar aro"
- Duba ajiya: "Duba ajiya"
- Duba LPO: "Buɗe LPO na"
- Bankin noma: "Buɗe bankin noma"
- Inshora: "Duba inshora na"
- Takardun banki: "Sauke takardun banki"
- Carbon credits: "Nuna carbon credits"
- Katunan: "Duba katunan na"
- Escrow: "Buɗe escrow"
- Mortgage: "Duba mortgage"
- Ilimi: "Bankin ilimi"
- Esusu: "Duba esusu"
- Taimako: "Taimako"
''',
  };

  // More flexible pattern matching that handles variations better
  static bool _anyPatternMatch(String text, List<String> patterns) {
    // Remove extra spaces and normalize
    final normalizedText = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    
    for (var pattern in patterns) {
      final normalizedPattern = pattern.replaceAll(RegExp(r'\s+'), ' ').trim();
      
      // Check if the text contains the pattern
      if (normalizedText.contains(normalizedPattern)) {
        return true;
      }
      
      // Also check word-by-word matching for phrases
      final textWords = normalizedText.split(' ');
      final patternWords = normalizedPattern.split(' ');
      
      // If pattern is subset of text words (in order)
      if (_containsWordsInOrder(textWords, patternWords)) {
        return true;
      }
    }
    return false;
  }
  
  // Helper to check if pattern words appear in text words in order
  static bool _containsWordsInOrder(List<String> textWords, List<String> patternWords) {
    if (patternWords.isEmpty) return false;
    if (patternWords.length > textWords.length) return false;
    
    int patternIndex = 0;
    for (var textWord in textWords) {
      if (textWord == patternWords[patternIndex]) {
        patternIndex++;
        if (patternIndex == patternWords.length) {
          return true;
        }
      }
    }
    return false;
  }

  static Map<String, dynamic> _parseTransferCommand(String text, String lang) {
    final params = <String, dynamic>{};
    
    // Extract amount
    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)').firstMatch(text);
    if (amountMatch != null) {
      params['amount'] = double.tryParse(amountMatch.group(1)!) ?? 0.0;
    }
    
    // Extract any 10-digit number as account number
    final accountMatch = RegExp(r'(\d{10})').firstMatch(text);
    if (accountMatch != null) {
      params['accountNumber'] = accountMatch.group(1);
    }
    
    return params;
  }

  static Map<String, dynamic> _parseBillPaymentCommand(String text, String lang) {
    final params = <String, dynamic>{};
    
    // Bill type keywords for each language
    final billKeywords = {
      'en': {
        'electricity': ['electricity', 'power', 'light'],
        'water': ['water'],
        'internet': ['internet', 'data'],
        'phone': ['phone', 'mobile', 'airtime'],
      },
      'yo': {
        'electricity': ['ina', 'electricity', 'power'],
        'water': ['omi', 'water'],
        'internet': ['internet', 'data'],
        'phone': ['foonu', 'phone', 'mobile'],
      },
      'ig': {
        'electricity': ['ọkụ', 'oku', 'electricity', 'power'],
        'water': ['mmiri', 'water'],
        'internet': ['internet', 'data'],
        'phone': ['ekwentị', 'ekwenti', 'phone', 'mobile'],
      },
      'ha': {
        'electricity': ['wuta', 'electricity', 'power', 'fitila'],
        'water': ['ruwa', 'water'],
        'internet': ['internet', 'data'],
        'phone': ['waya', 'phone', 'mobile', 'tarho'],
      },
    };
    
    final keywords = billKeywords[lang] ?? billKeywords['en']!;
    
    for (var entry in keywords.entries) {
      if (entry.value.any((keyword) => text.contains(keyword))) {
        params['billType'] = entry.key;
        break;
      }
    }
    
    // Extract amount
    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)').firstMatch(text);
    if (amountMatch != null) {
      params['amount'] = double.tryParse(amountMatch.group(1)!) ?? 0.0;
    }
    
    return params;
  }

  static Map<String, dynamic> _parseLoanCommand(String text, String lang) {
    final params = <String, dynamic>{};
    
    // Extract amount
    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)').firstMatch(text);
    if (amountMatch != null) {
      params['amount'] = double.tryParse(amountMatch.group(1)!) ?? 0.0;
    }
    
    return params;
  }

  static Map<String, dynamic> _parseSavingsCommand(String text, String lang) {
    final params = <String, dynamic>{};
    
    // Extract amount
    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)').firstMatch(text);
    if (amountMatch != null) {
      params['amount'] = double.tryParse(amountMatch.group(1)!) ?? 0.0;
    }
    
    return params;
  }

  /// Get help text for available commands
  static String getHelpText([String locale = 'en-NG']) {
    final lang = _localeMap[locale] ?? 'en';
    return _helpText[lang] ?? _helpText['en']!;
  }

  /// Parse voice command text into structured command
  static VoiceCommand parseCommand(
    String text, {
    double confidence = 0.0,
    String locale = 'en-NG',
  }) {
    final lang = _localeMap[locale] ?? 'en';
    final normalizedText = text.toLowerCase().trim();

    // DEBUG: Log what we're trying to match
    print('🔍 Parsing command:');
    print('   Text: "$normalizedText"');
    print('   Locale: $locale');
    print('   Language: $lang');

    // Check balance
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['balance'] ?? [])) {
      print('   ✅ Matched: checkBalance');
      return VoiceCommand(
        type: VoiceCommandType.checkBalance,
        parameters: {},
        originalText: text,
        confidence: confidence,
      );
    }

    // Transfer - CHECK THIS FIRST before other commands
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['transfer'] ?? [])) {
      print('   ✅ Matched: transfer');
      return VoiceCommand(
        type: VoiceCommandType.transfer,
        parameters: _parseTransferCommand(normalizedText, lang),
        originalText: text,
        confidence: confidence,
      );
    }

    // Pay bill
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['bill'] ?? [])) {
      print('   ✅ Matched: payBill');
      return VoiceCommand(
        type: VoiceCommandType.payBill,
        parameters: _parseBillPaymentCommand(normalizedText, lang),
        originalText: text,
        confidence: confidence,
      );
    }

    // View transactions
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['transactions'] ?? [])) {
      print('   ✅ Matched: viewTransactions');
      return VoiceCommand(
        type: VoiceCommandType.viewTransactions,
        parameters: {},
        originalText: text,
        confidence: confidence,
      );
    }

    // Apply for loan
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['loan'] ?? [])) {
      print('   ✅ Matched: applyLoan');
      return VoiceCommand(
        type: VoiceCommandType.applyLoan,
        parameters: _parseLoanCommand(normalizedText, lang),
        originalText: text,
        confidence: confidence,
      );
    }

    // View savings
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['savings'] ?? [])) {
      print('   ✅ Matched: openSavings');
      return VoiceCommand(
        type: VoiceCommandType.openSavings,
        parameters: _parseSavingsCommand(normalizedText, lang),
        originalText: text,
        confidence: confidence,
      );
    }

    // Help
    if (_anyPatternMatch(normalizedText, _patterns[lang]?['help'] ?? [])) {
      print('   ✅ Matched: help');
      return VoiceCommand(
        type: VoiceCommandType.help,
        parameters: {},
        originalText: text,
        confidence: confidence,
      );
    }

    // Unknown command
    print('   ❌ No match found - returning unknown');
    print('   Available patterns for $lang:');
    _patterns[lang]?.forEach((key, patterns) {
      print('     $key: ${patterns.take(3).join(", ")}...');
    });
    
    return VoiceCommand(
      type: VoiceCommandType.unknown,
      parameters: {},
      originalText: text,
      confidence: confidence,
    );
  }
}