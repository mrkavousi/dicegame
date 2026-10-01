import { registerStrings } from '../shared/i18n/index.jsx';

/** Hub + lobby text, and the name/description of every game card. */
const strings = {
  en: {
    'hub.brand': 'Game Hall',
    'hub.home': 'Back to the game hall',
    'hub.stars': '{n} stars',
    'hub.title': 'Pick a game',
    'hub.subtitle': 'Play with friends or against the computer. Win games to earn stars!',
    'hub.ages': 'Ages {range}',
    'hub.players': 'Players: {range}',
    'hub.wins': '{n} wins',
    'hub.loading': 'Loading…',

    'game.pig.name': 'Pig',
    'game.pig.desc': 'Roll the die and bank your points — but a 1 loses them all!',
    'game.connect4.name': 'Connect Four',
    'game.connect4.desc': 'Drop discs and connect four in a row before your opponent does!',
  },
  fa: {
    'hub.brand': 'سرای بازی',
    'hub.home': 'بازگشت به سرای بازی',
    'hub.stars': '{n} ستاره',
    'hub.title': 'یک بازی انتخاب کن',
    'hub.subtitle': 'با دوستانت یا با کامپیوتر بازی کن. با بردن بازی‌ها ستاره جمع کن!',
    'hub.ages': 'سن {range}',
    'hub.players': 'بازیکن: {range}',
    'hub.wins': '{n} برد',
    'hub.loading': 'در حال بارگذاری…',

    'game.pig.name': 'پیگ',
    'game.pig.desc': 'تاس بریز و امتیازت را بانک کن — اما یک ۱ همه‌چیز را می‌سوزاند!',
    'game.connect4.name': 'چهار در یک ردیف',
    'game.connect4.desc': 'دیسک بینداز و پیش از حریف چهارتا را در یک ردیف کن!',
  },
};

registerStrings(strings);

export default strings;
