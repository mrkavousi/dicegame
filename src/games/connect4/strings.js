import { registerStrings } from '../../shared/i18n/index.jsx';

/** Connect Four text (the lobby card strings live in `casino/strings.js`). */
const strings = {
  en: {
    'c4.title': 'Connect Four',
    'c4.tagline': 'Drop. Connect. Win.',
    'c4.rules.title': 'How to play',
    'c4.rules.1': 'Take turns dropping a disc into a column.',
    'c4.rules.2': 'Your disc falls to the lowest free spot.',
    'c4.rules.3': 'Connect four of your discs in a row — sideways, up and down, or diagonally — to win!',
    'c4.boardLabel': 'Connect Four board',
    'c4.column': 'Drop a disc in column {n}',
    'c4.columnFull': 'Column {n} is full',
    'c4.moveAnn': '{name} dropped a disc in column {col}.',
    'c4.win': '{name} connected four!',
    'c4.winSub': 'Great game!',
    'c4.draw': 'A draw — the board is full!',
    'c4.drawSub': 'Nobody wins this time. Play again?',
    'c4.changePlayers': 'Change players',
    'c4.gameNo': 'Game {n}',
    'c4.keys': 'Keys 1–7 drop a disc',
  },
  fa: {
    'c4.title': 'چهار در یک ردیف',
    'c4.tagline': 'بنداز. وصل کن. ببر.',
    'c4.rules.title': 'طرز بازی',
    'c4.rules.1': 'نوبتی یک دیسک را در یکی از ستون‌ها بینداز.',
    'c4.rules.2': 'دیسک تو تا پایین‌ترین جای خالی می‌افتد.',
    'c4.rules.3': 'چهار دیسک خودت را در یک ردیف — افقی، عمودی یا مورب — کنار هم بچین تا ببری!',
    'c4.boardLabel': 'صفحهٔ چهار در یک ردیف',
    'c4.column': 'انداختن دیسک در ستون {n}',
    'c4.columnFull': 'ستون {n} پر است',
    'c4.moveAnn': '{name} دیسک را در ستون {col} انداخت.',
    'c4.win': '{name} چهارتا را به هم وصل کرد!',
    'c4.winSub': 'بازی عالی بود!',
    'c4.draw': 'مساوی — صفحه پر شد!',
    'c4.drawSub': 'این بار کسی نبرد. دوباره بازی کنیم؟',
    'c4.changePlayers': 'تغییر بازیکنان',
    'c4.gameNo': 'بازی {n}',
    'c4.keys': 'کلیدهای ۱ تا ۷ دیسک می‌اندازند',
  },
};

registerStrings(strings);

export default strings;
