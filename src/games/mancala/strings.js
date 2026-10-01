import { registerStrings } from '../../shared/i18n/index.jsx';

/** Mancala text (the lobby card strings live in `casino/strings.js`). */
const strings = {
  en: {
    'mnc.title': 'Mancala',
    'mnc.tagline': 'Sow. Capture. Collect.',
    'mnc.rules.1': 'Pick one of your pits and sow its stones — one in each pit — going round the board.',
    'mnc.rules.2': 'Your last stone lands in your store? Play again!',
    'mnc.rules.3': 'It lands in an empty pit of yours? Capture the stones across from it!',
    'mnc.rules.4': 'When one side is empty the game ends. The most stones in the store wins.',
    'mnc.stones': 'Stones per pit',
    'mnc.len.3': 'Quick',
    'mnc.len.4': 'Classic',
    'mnc.len.5': 'Long',
    'mnc.boardLabel': 'Mancala board',
    'mnc.pit': '{name}, pit {n}: {count} stones',
    'mnc.pitEmpty': '{name}, pit {n}: empty',
    'mnc.store': '{name}’s store: {count} stones',
    'mnc.moveAnn': '{name} sowed {n} stones.',
    'mnc.extraAnn': '{name}’s last stone landed in the store — play again!',
    'mnc.captureAnn': '{name} captured {n} stones!',
    'mnc.win': '{name} wins {a} to {b}!',
    'mnc.winSub': 'Great sowing!',
    'mnc.tie': 'It’s a tie!',
    'mnc.tieSub': 'Both players have {n} stones.',
    'mnc.changePlayers': 'Change players',
    'mnc.keys': 'Keys 1–6 play your pits.',
  },
  fa: {
    'mnc.title': 'منقله',
    'mnc.tagline': 'بکار. بگیر. جمع کن.',
    'mnc.rules.1': 'یکی از خانه‌های خودت را انتخاب کن و سنگ‌هایش را یکی‌یکی در خانه‌ها بریز و دور صفحه بچرخ.',
    'mnc.rules.2': 'آخرین سنگت در انبار خودت افتاد؟ دوباره بازی کن!',
    'mnc.rules.3': 'در یک خانهٔ خالی خودت افتاد؟ سنگ‌های روبه‌رویش را بگیر!',
    'mnc.rules.4': 'وقتی یک طرف خالی شود بازی تمام است. هر کس سنگ بیشتری در انبارش دارد برنده است.',
    'mnc.stones': 'سنگ در هر خانه',
    'mnc.len.3': 'کوتاه',
    'mnc.len.4': 'کلاسیک',
    'mnc.len.5': 'بلند',
    'mnc.boardLabel': 'صفحهٔ منقله',
    'mnc.pit': '{name}، خانهٔ {n}: {count} سنگ',
    'mnc.pitEmpty': '{name}، خانهٔ {n}: خالی',
    'mnc.store': 'انبار {name}: {count} سنگ',
    'mnc.moveAnn': '{name} {n} سنگ را پخش کرد.',
    'mnc.extraAnn': 'آخرین سنگ {name} در انبار افتاد — دوباره بازی کن!',
    'mnc.captureAnn': '{name} {n} سنگ را گرفت!',
    'mnc.win': '{name} با {a} بر {b} برنده شد!',
    'mnc.winSub': 'پخش‌کردن عالی!',
    'mnc.tie': 'مساوی شد!',
    'mnc.tieSub': 'هر دو بازیکن {n} سنگ دارند.',
    'mnc.changePlayers': 'تغییر بازیکنان',
    'mnc.keys': 'کلیدهای ۱ تا ۶ خانه‌های تو را بازی می‌کنند.',
  },
};

registerStrings(strings);

export default strings;
