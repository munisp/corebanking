/**
 * Voice Command Parser for Web App
 * Parses voice commands in multiple languages (English, Yoruba, Igbo, Hausa)
 */

import { toLowerCase } from '../utils/textCaseUtils';

export const VoiceCommandType = {
  CHECK_BALANCE: 'check_balance',
  TRANSFER: 'transfer',
  PAY_BILL: 'pay_bill',
  VIEW_TRANSACTIONS: 'view_transactions',
  APPLY_LOAN: 'apply_loan',
  OPEN_SAVINGS: 'open_savings',
  VIEW_LPOS: 'view_lpos',
  VIEW_AGRICULTURE: 'view_agriculture',
  VIEW_INSURANCE: 'view_insurance',
  VIEW_BANK_STATEMENT: 'view_bank_statement',
  VIEW_CARBON_CREDITS: 'view_carbon_credits',
  VIEW_CARDS: 'view_cards',
  VIEW_ESCROW: 'view_escrow',
  VIEW_MORTGAGE: 'view_mortgage',
  VIEW_EDUCATION: 'view_education',
  VIEW_ESUSU: 'view_esusu',
  VIEW_VIRTUAL_ACCOUNTS: 'view_virtual_accounts',
  HELP: 'help',
  UNKNOWN: 'unknown',
} as const;

export type VoiceCommandType = (typeof VoiceCommandType)[keyof typeof VoiceCommandType];

export interface VoiceCommand {
  type: VoiceCommandType;
  parameters: Record<string, unknown>;
  originalText: string;
  confidence: number;
}

export class VoiceCommandParser {
  private static readonly LOCALE_MAP: Record<string, string> = {
    'en-NG': 'en',
    'en-US': 'en',
    'yo-NG': 'yo',
    'ig-NG': 'ig',
    'ha-NG': 'ha',
  };

  private static readonly PATTERNS: Record<string, Record<string, string[]>> = {
    en: {
      balance: [
        'check balance', 'what is my balance', 'show balance', 'account balance',
        'my balance', 'check my account', 'balance', 'check account',
      ],
      transfer: [
        'transfer', 'send money', 'send', 'pay to', 'send funds', 'make transfer',
        'i want to transfer', 'i want to send',
      ],
      bill: [
        'pay bill', 'pay my bill', 'electricity bill', 'water bill',
        'internet bill', 'phone bill', 'bill payment', 'pay electricity',
        'pay water', 'pay internet', 'pay phone',
      ],
      transactions: [
        'show my transactions', 'view recent transactions', 'transaction history',
        'show transactions', 'my transactions', 'recent transactions', 'view transactions',
      ],
      loan: [
        'apply for a loan', 'i need a loan', 'loan application',
        'loan', 'get a loan', 'request loan', 'apply for loan',
      ],
      savings: [
        'view savings', 'savings', 'my savings', 'check savings', 'savings account',
        'show savings', 'open savings',
      ],
      lpos: [
        'view lpos', 'my lpos', 'lpo', 'purchase orders', 'local purchase order',
      ],
      agriculture: [
        'agriculture', 'farming', 'agric', 'farm loan', 'agri loan',
      ],
      insurance: [
        'insurance', 'my insurance', 'view insurance', 'insurance policy',
      ],
      bank_statement: [
        'bank statement', 'my statement', 'account statement', 'view statement',
      ],
      carbon_credits: [
        'carbon credits', 'carbon', 'offset', 'carbon footprint',
      ],
      cards: [
        'my cards', 'view cards', 'card', 'debit card', 'credit card',
      ],
      escrow: [
        'escrow', 'my escrow', 'view escrow',
      ],
      mortgage: [
        'mortgage', 'home loan', 'property loan', 'my mortgage',
      ],
      education: [
        'education loan', 'school loan', 'student loan', 'education',
      ],
      esusu: [
        'esusu', 'rotating savings', 'thrift', 'cooperative',
      ],
      virtual_accounts: [
        'virtual account', 'van', 'virtual number', 'virtual accounts',
      ],
      help: [
        'help', 'what can you do', 'how to use', 'commands',
        'what can i say', 'assist me', 'assistance',
      ],
    },
    yo: {
      balance: [
        'sayewo iwontunwonsi', 'ṣayẹwo iwontunwonsi',
        'kini iwontunwonsi', 'iwontunwonsi akọọlẹ', 'iwontunwonsi akoole',
        'iwontunwonsi mi', 'sayewo akoole mi', 'ṣayẹwo akọọlẹ mi',
        'wo iwontunwonsi', 'iwontunwonsi', 'akoole mi', 'akọọlẹ mi',
      ],
      transfer: [
        'mo fe sanwo', 'mo fẹ sanwo', 'mo fe fi owo', 'mo fẹ fi owo',
        'firanṣẹ', 'firanṣe', 'firansẹ', 'firanse',
        'sanwo', 'fi owo ransẹ', 'fi owo ranse', 'fi owo ranṣẹ',
        'mo fe fi owo ransẹ', 'mo fẹ fi owo ransẹ',
        'ran owo', 'ransẹ owo', 'ranṣẹ owo',
      ],
      bill: [
        'sanwo fun ina', 'sanwo ina', 'san owo ina',
        'sanwo fun omi', 'sanwo omi', 'san owo omi',
        'sanwo fun internet', 'sanwo internet', 'san owo internet',
        'sanwo fun foonu', 'sanwo foonu', 'san owo foonu', 'sanwo phone',
        'san owo', 'sanwo fun', 'san',
      ],
      transactions: [
        'fi awọn iṣowo han', 'fi awon isowo han',
        'ṣe afihan iṣowo', 'se afihan isowo',
        'wo iṣowo', 'wo isowo', 'iṣowo mi', 'isowo mi',
        'itan iṣowo', 'itan isowo', 'isowo',
      ],
      loan: [
        'bere awin', 'beere awin', 'mo nilo awin', 'awin',
        'mo fe gba awin', 'mo fẹ gba awin',
        'se awin', 'ṣe awin',
      ],
      savings: [
        'wo fipamọ', 'wo fipamo', 'fipamọ', 'fipamo',
        'ifowopamọ', 'ifowopamo', 'wo ifowopamọ', 'wo ifowopamo',
        'akaunt fipamọ', 'akaunt fipamo',
      ],
      help: [
        'iranlọwọ', 'iranlowo', 'ṣe iranlọwọ', 'se iranlowo',
        'kí ni o le ṣe', 'ki ni o le se', 'bawo ni mo ṣe le lo', 'bawo ni mo se le lo',
        'ran mi lọwọ', 'ran mi lowo', 'egbe mi',
      ],
    },
    ig: {
      balance: [
        'lelee nguzozi', 'lee nguzozi', 'lee ego', 'lelee ego',
        'gịnị bụ nguzozi', 'gini bu nguzozi', 'kedu nguzozi',
        'nguzozi akaụntụ', 'nguzozi akauntu', 'nguzozi m',
        'lelee akaụntụ m', 'lee akauntu m', 'akaụntụ m', 'akauntu m',
        'nguzozi', 'ego m', 'chekwa ego m',
      ],
      transfer: [
        'zipu', 'ziga', 'zitere', 'zite ego',
        'nyefee', 'nyefe ego', 'nye ego',
        'ziga ego', 'zipu ego', 'zitere ego',
        'achọrọ m izipu ego', 'achoro m izipu ego',
        'achọrọ m iziga ego', 'achoro m iziga ego',
        'm ga-eziga ego', 'm ga eziga ego', 'm ga ziga ego',
        'transfer', 'nyefe',
      ],
      bill: [
        'kwụọ ụgwọ ọkụ', 'kwuo ugwo oku', 'kwụọ ọkụ', 'kwuo oku',
        'kwụọ ụgwọ mmiri', 'kwuo ugwo mmiri', 'kwụọ mmiri', 'kwuo mmiri',
        'kwụọ ụgwọ internet', 'kwuo ugwo internet', 'kwụọ internet', 'kwuo internet',
        'kwụọ ụgwọ ekwentị', 'kwuo ugwo ekwenti', 'kwụọ ekwentị', 'kwuo ekwenti',
        'kwụọ ụgwọ', 'kwuo ugwo', 'akwụ ụgwọ', 'akwu ugwo',
      ],
      transactions: [
        'gosi m azụmahịa', 'gosi m azumahia', 'gosipụta azụmahịa', 'gosiputa azumahia',
        'lee azụmahịa', 'lee azumahia', 'lelee azụmahịa', 'lelee azumahia',
        'akụkọ azụmahịa', 'akuko azumahia', 'ihe m mere', 'ọrụ azụmahịa', 'oru azumahia',
      ],
      loan: [
        'tinye akwụkwọ maka mbinye ego', 'tinye akwukwo maka mbinye ego',
        'achọrọ m mbinye ego', 'achoro m mbinye ego', 'mbinye ego',
        'nweta mbinye ego', 'rịọ mbinye ego', 'rio mbinye ego',
      ],
      savings: [
        'lee nchekwa', 'lelee nchekwa', 'nchekwa m', 'ego nchekwa',
        'akaụntụ nchekwa', 'akauntu nchekwa', 'gosi nchekwa',
      ],
      help: [
        'nyere m aka', 'enyemaka', 'kedu ihe i nwere ike ime',
        'kedu ka m ga-esi jiri ya', 'nyere aka', 'nye m aka',
      ],
    },
    ha: {
      balance: [
        'duba ma\'auni', 'duba ma auni', 'nawa ne ma\'aunina', 'nawa ne ma aunina',
        'ma\'aunin asusuna', 'ma aunin asusuna', 'ma\'aunina', 'ma aunina',
        'asusuna', 'nawa ne kudina', 'duba asusuna',
      ],
      transfer: [
        'tura kudi', 'aika kudi', 'biya', 'tura',
        'ina son tura kudi', 'ina so tura kudi',
        'aika wa kudi', 'biya kudi',
      ],
      bill: [
        'biya kudin wuta', 'biya wuta', 'kudin wuta',
        'biya kudin ruwa', 'biya ruwa', 'kudin ruwa',
        'biya kudin internet', 'biya internet', 'kudin internet',
        'biya kudin waya', 'biya waya', 'kudin waya',
        'biya kudi', 'biyan kudi',
      ],
      transactions: [
        'nuna mu\'amala', 'nuna mu amala', 'duba mu\'amala', 'duba mu amala',
        'mu\'amalar kwanan nan', 'mu amalar kwanan nan',
        'tarihin mu\'amala', 'tarihin mu amala', 'mu\'amalata', 'mu amalata',
      ],
      loan: [
        'nemi rance', 'neman rance', 'ina bukatar rance',
        'rance', 'samu rance', 'nema rance',
      ],
      savings: [
        'duba ajiya', 'ajiyata', 'ajiya', 'asusun ajiya',
        'nuna ajiya', 'kudina na ajiya',
      ],
      help: [
        'taimako', 'yi mini taimako', 'me za ka iya yi',
        'yaya zan yi amfani', 'taimake ni', 'ina bukatar taimako',
      ],
    },
  };

  /**
   * Parse a voice command.
   * Signature matches what VoiceAssistantScreen calls:
   *   VoiceCommandParser.parseCommand(text, confidence, locale)
   */
  static parseCommand(text: string, confidence: number = 0, locale: string = 'en-NG'): VoiceCommand {
    return VoiceCommandParser.parse(text, locale, confidence);
  }

  static parse(text: string, locale: string = 'en-NG', confidence: number = 0): VoiceCommand {
    const normalizedText = toLowerCase(text).trim();
    const language = this.LOCALE_MAP[locale] || 'en';
    const commandType = this.matchPattern(normalizedText, language);
    const parameters = this.extractParameters(normalizedText, commandType, language);
    return { type: commandType, parameters, originalText: text, confidence };
  }

  private static matchPattern(text: string, language: string): VoiceCommandType {
    const patterns = this.PATTERNS[language] || this.PATTERNS.en;
    for (const [commandKey, commandPatterns] of Object.entries(patterns)) {
      for (const pattern of commandPatterns) {
        if (this.textContainsPattern(text, pattern)) {
          return this.getCommandType(commandKey);
        }
      }
    }
    return VoiceCommandType.UNKNOWN;
  }

  private static textContainsPattern(text: string, pattern: string): boolean {
    if (text.includes(pattern)) return true;
    const words = pattern.split(' ');
    return words.every(word => text.includes(word));
  }

  private static getCommandType(key: string): VoiceCommandType {
    const typeMap: Record<string, VoiceCommandType> = {
      balance: VoiceCommandType.CHECK_BALANCE,
      transfer: VoiceCommandType.TRANSFER,
      bill: VoiceCommandType.PAY_BILL,
      transactions: VoiceCommandType.VIEW_TRANSACTIONS,
      loan: VoiceCommandType.APPLY_LOAN,
      savings: VoiceCommandType.OPEN_SAVINGS,
      lpos: VoiceCommandType.VIEW_LPOS,
      agriculture: VoiceCommandType.VIEW_AGRICULTURE,
      insurance: VoiceCommandType.VIEW_INSURANCE,
      bank_statement: VoiceCommandType.VIEW_BANK_STATEMENT,
      carbon_credits: VoiceCommandType.VIEW_CARBON_CREDITS,
      cards: VoiceCommandType.VIEW_CARDS,
      escrow: VoiceCommandType.VIEW_ESCROW,
      mortgage: VoiceCommandType.VIEW_MORTGAGE,
      education: VoiceCommandType.VIEW_EDUCATION,
      esusu: VoiceCommandType.VIEW_ESUSU,
      virtual_accounts: VoiceCommandType.VIEW_VIRTUAL_ACCOUNTS,
      help: VoiceCommandType.HELP,
    };
    return typeMap[key] || VoiceCommandType.UNKNOWN;
  }

  private static extractParameters(
    text: string,
    type: VoiceCommandType,
    _language: string
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      parameters.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    const accountMatch = text.match(/\b(\d{10,})\b/);
    if (accountMatch) {
      parameters.accountNumber = accountMatch[1];
    }

    if (type === VoiceCommandType.PAY_BILL) {
      if (text.includes('electricity') || text.includes('ina') || text.includes('wuta')) {
        parameters.billType = 'electricity';
      } else if (text.includes('water') || text.includes('omi') || text.includes('mmiri') || text.includes('ruwa')) {
        parameters.billType = 'water';
      } else if (text.includes('internet')) {
        parameters.billType = 'internet';
      } else if (text.includes('phone') || text.includes('foonu') || text.includes('waya')) {
        parameters.billType = 'phone';
      }
    }

    return parameters;
  }

  static getResponseText(type: VoiceCommandType, locale: string = 'en-NG'): string {
    const language = this.LOCALE_MAP[locale] || 'en';

    const responses: Record<string, Partial<Record<VoiceCommandType, string>>> = {
      en: {
        [VoiceCommandType.CHECK_BALANCE]: "I'll check your balance for you.",
        [VoiceCommandType.TRANSFER]: "I'll help you transfer money. Please provide the recipient details.",
        [VoiceCommandType.PAY_BILL]: "I'll help you pay your bill. Which bill would you like to pay?",
        [VoiceCommandType.VIEW_TRANSACTIONS]: "I'll show you your recent transactions.",
        [VoiceCommandType.APPLY_LOAN]: "I'll help you apply for a loan.",
        [VoiceCommandType.OPEN_SAVINGS]: "I'll show you your savings accounts.",
        [VoiceCommandType.VIEW_LPOS]: "I'll show you your purchase orders.",
        [VoiceCommandType.VIEW_AGRICULTURE]: "I'll take you to the agriculture section.",
        [VoiceCommandType.VIEW_INSURANCE]: "I'll show you your insurance policies.",
        [VoiceCommandType.VIEW_BANK_STATEMENT]: "I'll open your bank statement.",
        [VoiceCommandType.VIEW_CARBON_CREDITS]: "I'll take you to carbon credits.",
        [VoiceCommandType.VIEW_CARDS]: "I'll show you your cards.",
        [VoiceCommandType.VIEW_ESCROW]: "I'll show you your escrow accounts.",
        [VoiceCommandType.VIEW_MORTGAGE]: "I'll show you your mortgages.",
        [VoiceCommandType.VIEW_EDUCATION]: "I'll show you your education loans.",
        [VoiceCommandType.VIEW_ESUSU]: "I'll take you to your esusu groups.",
        [VoiceCommandType.VIEW_VIRTUAL_ACCOUNTS]: "I'll show you your virtual accounts.",
        [VoiceCommandType.HELP]: "I can help you check balance, transfer money, pay bills, view transactions, apply for loans, and more. What would you like to do?",
        [VoiceCommandType.UNKNOWN]: "I'm sorry, I didn't understand that. Please try again or say 'help' for available commands.",
      },
      yo: {
        [VoiceCommandType.CHECK_BALANCE]: "Emi yoo ṣayẹwo iwontunwonsi rẹ fun ọ.",
        [VoiceCommandType.TRANSFER]: "Emi yoo ran ọ lọwọ lati fi owo ransẹ.",
        [VoiceCommandType.PAY_BILL]: "Emi yoo ran ọ lọwọ lati sanwo fun owo.",
        [VoiceCommandType.VIEW_TRANSACTIONS]: "Emi yoo fi awọn iṣowo aipẹ rẹ han ọ.",
        [VoiceCommandType.APPLY_LOAN]: "Emi yoo ran ọ lọwọ lati beere awin.",
        [VoiceCommandType.OPEN_SAVINGS]: "Emi yoo fi awọn akaunt ifowopamọ rẹ han ọ.",
        [VoiceCommandType.HELP]: "Mo le ran ọ lọwọ lati ṣayẹwo iwontunwonsi, fi owo ransẹ, sanwo fun awọn owo, wo awọn iṣowo, beere awin. Kini o fẹ ṣe?",
        [VoiceCommandType.UNKNOWN]: "Ma binu, emi ko loye iyẹn. Jọwọ gbiyanju lẹẹkansi tabi sọ 'iranlọwọ'.",
      },
      ig: {
        [VoiceCommandType.CHECK_BALANCE]: "Aga m lelee nguzozi gị.",
        [VoiceCommandType.TRANSFER]: "Aga m enyere gị aka iziga ego.",
        [VoiceCommandType.PAY_BILL]: "Aga m enyere gị aka ịkwụ ụgwọ.",
        [VoiceCommandType.VIEW_TRANSACTIONS]: "Aga m egosi gị azụmahịa gị nso nso a.",
        [VoiceCommandType.APPLY_LOAN]: "Aga m enyere gị aka itinye akwụkwọ maka mbinye ego.",
        [VoiceCommandType.OPEN_SAVINGS]: "Aga m egosi gị akaụntụ nchekwa gị.",
        [VoiceCommandType.HELP]: "Enwere m ike inyere gị aka ịlelee nguzozi, ziga ego, kwụọ ụgwọ, lee azụmahịa. Kedu ihe ị chọrọ ime?",
        [VoiceCommandType.UNKNOWN]: "Ndo, aghọtaghị m nke ahụ. Biko gbalịa ọzọ ma ọ bụ kwuo 'enyemaka'.",
      },
      ha: {
        [VoiceCommandType.CHECK_BALANCE]: "Zan duba ma'auninka.",
        [VoiceCommandType.TRANSFER]: "Zan taimake ka ka tura kudi.",
        [VoiceCommandType.PAY_BILL]: "Zan taimake ka ka biya kudin.",
        [VoiceCommandType.VIEW_TRANSACTIONS]: "Zan nuna maka mu'amalar kwanan nan.",
        [VoiceCommandType.APPLY_LOAN]: "Zan taimake ka ka nemi rance.",
        [VoiceCommandType.OPEN_SAVINGS]: "Zan nuna maka asusun ajiya.",
        [VoiceCommandType.HELP]: "Zan iya taimake ka ka duba ma'auni, tura kudi, biya kudin, duba mu'amala, neman rance. Me kake so ka yi?",
        [VoiceCommandType.UNKNOWN]: "Yi hakuri, ban gane wannan ba. Don Allah sake gwadawa ko ce 'taimako'.",
      },
    };

    const languageResponses = responses[language] || responses.en;
    return languageResponses[type] ?? languageResponses[VoiceCommandType.UNKNOWN] ?? "I'm sorry, I didn't understand that.";
  }

  static getHelpText(locale: string = 'en-NG'): string {
    return this.getResponseText(VoiceCommandType.HELP, locale);
  }
}
