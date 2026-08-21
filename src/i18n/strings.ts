/**
 * Flat string tables for the app's two supported languages. `en` and `ja`
 * MUST have identical key sets -- `LanguageProvider.t()` falls back to `en`
 * (then to the raw key) when a key is missing from the resolved table, so a
 * drift here silently degrades to English rather than crashing.
 *
 * Keys are dot-namespaced by screen/component (e.g. `settings.done`) to keep
 * large tables scannable. Params use `{name}` placeholders, applied by
 * `format()` below.
 */

/** Replaces `{name}`-style placeholders in `template` with `params[name]`. */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

export const en = {
  // App shell / tab bar
  'app.tab.discover': 'Discover',
  'app.tab.collection': 'Collection',
  'app.a11y.swipeTab': 'Swipe tab',
  'app.a11y.collectionTab': 'Collection tab',
  'app.locationAlert.title': 'Location unavailable',
  'app.locationAlert.message':
    'Nibble needs location access to set Home. Enable it in your device Settings and try again.',

  // Common / shared across screens
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.skip': 'Skip',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.home': 'Home',
  'common.signInWithApple': 'Sign in with Apple',
  'common.a11y.rateStars': 'Rate {n} star{plural}',

  // SwipeScreen
  'swipe.emptyTitle': "That's everyone nearby for now.",
  'swipe.emptySubtitle': 'Here are a few ways to keep going.',
  'swipe.widenSearch': 'Widen the search',
  'swipe.resetSeen': 'Reset seen',
  'swipe.resetSeenConfirm': 'Tap again to confirm',
  'swipe.seeWantList': 'See Want list',
  'swipe.a11y.undo': 'Undo',
  'swipe.a11y.undoHint': 'Undo your last swipe',
  'swipe.a11y.changeArea': 'Change deck area',
  'swipe.a11y.widenRadius': 'Widen search radius',
  'swipe.a11y.resetSeenPlaces': 'Reset seen places',
  'swipe.a11y.resetSeenHint': 'Brings back places you already passed on',

  // Card
  'card.notForMe': 'Not for me',
  'card.been': 'Been',
  'card.save': 'Save',
  'card.hint.swipeLeft': 'Swipe left',
  'card.hint.swipeUp': 'Swipe up',
  'card.hint.swipeRight': 'Swipe right',
  'card.a11y.viewDetails': 'View details for {name}',
  'card.a11y.prevPhoto': 'Previous photo',
  'card.a11y.nextPhoto': 'Next photo',

  // RatingPrompt
  'ratingPrompt.title': 'How was {name}?',
  'ratingPrompt.a11y.skip': 'Skip rating',

  // PlaceDetailModal
  'placeDetail.yourReview': 'Your review',
  'placeDetail.reviewSubtitle': 'Rate it to sharpen your recommendations. Stays private.',
  'placeDetail.whatStoodOut': 'What stood out?',
  'placeDetail.saveReview': 'Save review',
  'placeDetail.iWent': 'I went',
  'placeDetail.openInMaps': 'Open in Maps',
  'placeDetail.googleReview': 'Google review',
  'placeDetail.a11y.writeGoogleReview': 'Write a Google review',
  'placeDetail.a11y.closeDetail': 'Close place detail',
  'placeDetail.a11y.tag': '{tag} tag',

  // SettingsScreen
  'settings.done': 'Done',
  'settings.a11y.close': 'Close settings',
  'settings.title': 'Settings',
  'settings.section.appearance': 'APPEARANCE',
  'settings.section.language': 'LANGUAGE',
  'settings.section.account': 'ACCOUNT',
  'settings.section.location': 'LOCATION',
  'settings.section.discover': 'DISCOVER',
  'settings.section.data': 'DATA',
  'settings.appearance.system': 'System',
  'settings.appearance.light': 'Light',
  'settings.appearance.dark': 'Dark',
  'settings.a11y.appearanceOption': '{label} appearance',
  'settings.language.system': 'System',
  'settings.language.footnote': 'Changes the language used throughout the app.',
  'settings.a11y.languageOption': '{label} language',
  'settings.account.status': 'Status',
  'settings.account.signedIn': 'Signed in',
  'settings.account.signOut': 'Sign out',
  'settings.account.footnote': 'Signing out keeps your data on this device.',
  'settings.location.permission': 'Permission',
  'settings.location.enabled': 'Enabled',
  'settings.location.off': 'Off',
  'settings.location.notSet': 'Not set',
  'settings.location.enable': 'Enable location',
  'settings.location.openSettings': 'Open Settings',
  'settings.location.footnote':
    'Nibble uses your location to center the deck nearby. Without it, the deck defaults to Tokyo.',
  'settings.discover.bringBack': 'Bring back passed places',
  'settings.discover.footnote':
    'Places you swiped "not for me" stay out of Discover. Tap to give them another look.',
  'settings.discover.alertTitle': 'Bring back passed places?',
  'settings.discover.alertMessage':
    'Places you marked "not for me" will show up in Discover again. Your Want and Been lists are untouched.',
  'settings.discover.alertConfirm': 'Bring back',
  'settings.data.replayIntro': 'Replay intro',
  'settings.data.resetAll': 'Reset all data',
  'settings.data.footnote':
    "Reset clears this device's taste history and signs you out. Data synced to your account is not deleted.",
  'settings.data.alertTitle': 'Reset all data?',
  'settings.data.alertMessage':
    'This clears your taste history and signs you out on this device. Your appearance setting is kept, and any data synced to your account stays safe.',
  'settings.data.alertConfirm': 'Reset',

  // CollectionScreen
  'collection.tab.want': 'Want',
  'collection.tab.been': 'Been',
  'collection.a11y.tab': '{label} tab',
  'collection.syncBanner': 'Sync across devices',
  'collection.a11y.tonightButton': 'Help me pick a place',
  'collection.whereTo': 'Where to?',
  'collection.want.empty': 'Swipe right on places to build your Want list.',
  'collection.been.empty': 'Places you mark Been will show up here.',
  'collection.a11y.openPlace': 'Open {name}',
  'collection.a11y.iWentTo': 'I went to {name}',
  'collection.taste.eyebrow': 'Your taste',
  'collection.taste.unitOne': 'place',
  'collection.taste.unitOther': 'places',
  'collection.taste.footerBuilt': 'Built from {count} {unit} you swiped',
  'collection.taste.footerPriceLean': ' · mostly {price}',
  'collection.yourRating': ' · your rating {stars}',

  // OnboardingScreen
  'onboarding.title': 'Where have you been?',
  'onboarding.subtitle':
    'Tap everywhere you recognize. It takes about a minute, and it teaches your deck what you like.',
  'onboarding.a11y.skip': 'Skip onboarding',
  'onboarding.a11y.continue': 'Continue to deck',
  'onboarding.continue': 'Continue',
  'onboarding.continueWithCount': 'Continue — {count} been',
  'onboarding.a11y.beenTo': 'Been to {name}',

  // DeckContextControl
  'deck.title': 'Deck area',
  'deck.radius': 'Radius',
  'deck.area': 'Area',
  'deck.a11y.radius': 'Radius {label}',
  'deck.currentLocation': 'Current location',
  'deck.updateHome': 'Update Home to current location',
  'deck.setHome': 'Set current location as Home',
  'deck.clearHome': 'Clear Home',

  // SignInPromptModal
  'signIn.title': 'Save your taste graph',
  'signIn.body':
    'Sign in to sync your Want list, Been history, and taste graph across devices. Your graph and history stay free either way.',
  'signIn.notNow': 'Not now',

  // TonightSheet
  'tonight.question.cuisine': 'What do you want to eat?',
  'tonight.question.price': 'What price range?',
  'tonight.question.vibe': 'What kind of vibe?',
  'tonight.a11y.randomPick': 'Just pick for me',
  'tonight.randomLink': 'just pick for me 🎲',
  'tonight.emptyNoWant': 'Swipe right on a few places first, then I can pick one for you.',
  'tonight.emptyNoMore': "That's every Want spot for now. Swipe more to get fresh ideas.",
  'tonight.a11y.choose': 'Choose {label}',
  'tonight.any': 'Any',
  'tonight.a11y.noPreference': 'No preference',
  'tonight.distanceAway': '{distance}m away',
  'tonight.a11y.letsGo': "Let's go to {name}",
  'tonight.letsGo': "Let's go",
  'tonight.a11y.suggestAnother': 'Suggest another',
  'tonight.noMoreNearby': 'No more nearby',
  'tonight.showAnother': 'Show another',
  'tonight.startOver': 'Start over',
  'tonight.a11y.close': 'Close tonight suggestion',

  // SettingsButton
  'settingsButton.a11y.open': 'Open settings',
} as const;

export type StringKey = keyof typeof en;

export const ja: Record<StringKey, string> = {
  // App shell / tab bar
  'app.tab.discover': 'ディスカバー',
  'app.tab.collection': 'コレクション',
  'app.a11y.swipeTab': 'ディスカバータブ',
  'app.a11y.collectionTab': 'コレクションタブ',
  'app.locationAlert.title': '位置情報が利用できません',
  'app.locationAlert.message':
    'Homeを設定するには位置情報へのアクセスが必要です。デバイスの設定でオンにしてから、もう一度お試しください。',

  // Common / shared across screens
  'common.cancel': 'キャンセル',
  'common.done': '完了',
  'common.skip': 'スキップ',
  'common.back': '戻る',
  'common.close': '閉じる',
  'common.dismiss': '閉じる',
  'common.home': '自宅',
  'common.signInWithApple': 'Appleでサインイン',
  'common.a11y.rateStars': '{n}つ星で評価',

  // SwipeScreen
  'swipe.emptyTitle': '近くのお店は以上です',
  'swipe.emptySubtitle': '続けるにはこんな方法があります',
  'swipe.widenSearch': '範囲を広げる',
  'swipe.resetSeen': '見た店をリセット',
  'swipe.resetSeenConfirm': 'もう一度タップで確定',
  'swipe.seeWantList': '行きたいリストを見る',
  'swipe.a11y.undo': '元に戻す',
  'swipe.a11y.undoHint': '直前のスワイプを取り消す',
  'swipe.a11y.changeArea': 'デッキのエリアを変更',
  'swipe.a11y.widenRadius': '検索範囲を広げる',
  'swipe.a11y.resetSeenPlaces': '見た店をリセット',
  'swipe.a11y.resetSeenHint': '興味なしにした店をもう一度表示します',

  // Card
  'card.notForMe': '興味なし',
  'card.been': '行った',
  'card.save': '保存',
  'card.hint.swipeLeft': '左にスワイプ',
  'card.hint.swipeUp': '上にスワイプ',
  'card.hint.swipeRight': '右にスワイプ',
  'card.a11y.viewDetails': '{name}の詳細を見る',
  'card.a11y.prevPhoto': '前の写真',
  'card.a11y.nextPhoto': '次の写真',

  // RatingPrompt
  'ratingPrompt.title': '「{name}」はどうでしたか？',
  'ratingPrompt.a11y.skip': '評価をスキップ',

  // PlaceDetailModal
  'placeDetail.yourReview': 'あなたのレビュー',
  'placeDetail.reviewSubtitle': '評価するとおすすめの精度が上がります。他の人には公開されません。',
  'placeDetail.whatStoodOut': '良かった点は？',
  'placeDetail.saveReview': 'レビューを保存',
  'placeDetail.iWent': '行った',
  'placeDetail.openInMaps': 'マップで開く',
  'placeDetail.googleReview': 'Googleクチコミ',
  'placeDetail.a11y.writeGoogleReview': 'Googleクチコミを書く',
  'placeDetail.a11y.closeDetail': '詳細を閉じる',
  'placeDetail.a11y.tag': '{tag}タグ',

  // SettingsScreen
  'settings.done': '完了',
  'settings.a11y.close': '設定を閉じる',
  'settings.title': '設定',
  'settings.section.appearance': '外観',
  'settings.section.language': '言語',
  'settings.section.account': 'アカウント',
  'settings.section.location': '位置情報',
  'settings.section.discover': 'ディスカバー',
  'settings.section.data': 'データ',
  'settings.appearance.system': 'システム',
  'settings.appearance.light': 'ライト',
  'settings.appearance.dark': 'ダーク',
  'settings.a11y.appearanceOption': '外観を{label}にする',
  'settings.language.system': 'システム',
  'settings.language.footnote': 'アプリ全体で使う言語を切り替えます。',
  'settings.a11y.languageOption': '言語を{label}にする',
  'settings.account.status': 'ステータス',
  'settings.account.signedIn': 'サインイン済み',
  'settings.account.signOut': 'サインアウト',
  'settings.account.footnote': 'サインアウトしても、このデバイスのデータは残ります。',
  'settings.location.permission': '許可設定',
  'settings.location.enabled': '有効',
  'settings.location.off': 'オフ',
  'settings.location.notSet': '未設定',
  'settings.location.enable': '位置情報を有効にする',
  'settings.location.openSettings': '設定を開く',
  'settings.location.footnote':
    '位置情報を使うと近くのお店を中心にデッキを表示します。オフの場合は東京を基準にします。',
  'settings.discover.bringBack': '興味なしにした店を戻す',
  'settings.discover.footnote':
    '「興味なし」にした店はディスカバーに表示されません。タップするともう一度見られます。',
  'settings.discover.alertTitle': '興味なしにした店を戻しますか？',
  'settings.discover.alertMessage':
    '「興味なし」にした店がディスカバーに再び表示されます。行きたい・行ったリストはそのままです。',
  'settings.discover.alertConfirm': '戻す',
  'settings.data.replayIntro': 'イントロをもう一度見る',
  'settings.data.resetAll': 'すべてのデータをリセット',
  'settings.data.footnote':
    'リセットするとこのデバイスの好み履歴が消え、サインアウトされます。アカウントに同期済みのデータは削除されません。',
  'settings.data.alertTitle': 'すべてのデータをリセットしますか？',
  'settings.data.alertMessage':
    'このデバイスの好み履歴が消え、サインアウトされます。外観の設定は保持され、アカウントに同期済みのデータも安全に残ります。',
  'settings.data.alertConfirm': 'リセット',

  // CollectionScreen
  'collection.tab.want': '行きたい',
  'collection.tab.been': '行った',
  'collection.a11y.tab': '{label}タブ',
  'collection.syncBanner': 'デバイス間で同期する',
  'collection.a11y.tonightButton': 'お店を選んでもらう',
  'collection.whereTo': '今夜どこ行く？',
  'collection.want.empty': '右にスワイプして行きたいリストを作りましょう。',
  'collection.been.empty': '「行った」にした店がここに表示されます。',
  'collection.a11y.openPlace': '{name}を開く',
  'collection.a11y.iWentTo': '{name}に行った',
  'collection.taste.eyebrow': 'あなたの好み',
  'collection.taste.unitOne': '件',
  'collection.taste.unitOther': '件',
  'collection.taste.footerBuilt': 'スワイプした{count}{unit}から作成',
  'collection.taste.footerPriceLean': '・{price}が中心',
  'collection.yourRating': '・評価 {stars}',

  // OnboardingScreen
  'onboarding.title': 'これまで行ったことは？',
  'onboarding.subtitle': '見覚えのある店をタップしてください。1分ほどで、デッキがあなたの好みを学習します。',
  'onboarding.a11y.skip': 'イントロをスキップ',
  'onboarding.a11y.continue': 'デッキに進む',
  'onboarding.continue': '続ける',
  'onboarding.continueWithCount': '続ける — {count}件を選択',
  'onboarding.a11y.beenTo': '{name}に行った',

  // DeckContextControl
  'deck.title': 'デッキのエリア',
  'deck.radius': '範囲',
  'deck.area': 'エリア',
  'deck.a11y.radius': '範囲{label}',
  'deck.currentLocation': '現在地',
  'deck.updateHome': '現在地で自宅を更新',
  'deck.setHome': '現在地を自宅に設定',
  'deck.clearHome': '自宅を解除',

  // SignInPromptModal
  'signIn.title': '好みのデータを保存',
  'signIn.body':
    'サインインすると、行きたいリスト・行った履歴・好みのデータをデバイス間で同期できます。サインインしなくても、これらは無料でご利用いただけます。',
  'signIn.notNow': '今はしない',

  // TonightSheet
  'tonight.question.cuisine': '何が食べたい気分？',
  'tonight.question.price': '予算はどのくらい？',
  'tonight.question.vibe': 'どんな雰囲気がいい？',
  'tonight.a11y.randomPick': 'おまかせで選ぶ',
  'tonight.randomLink': 'とりあえず選んで 🎲',
  'tonight.emptyNoWant': 'まずは右にスワイプしてお店を追加すると、選んでお届けできます。',
  'tonight.emptyNoMore': '行きたいリストのお店は以上です。もっとスワイプして選択肢を増やしましょう。',
  'tonight.a11y.choose': '{label}を選ぶ',
  'tonight.any': 'こだわらない',
  'tonight.a11y.noPreference': 'こだわらない',
  'tonight.distanceAway': '{distance}m先',
  'tonight.a11y.letsGo': '{name}へ行く',
  'tonight.letsGo': '行こう',
  'tonight.a11y.suggestAnother': '他の候補を見る',
  'tonight.noMoreNearby': '近くに他の候補はありません',
  'tonight.showAnother': '他の候補を見る',
  'tonight.startOver': '最初からやり直す',
  'tonight.a11y.close': '今夜の提案を閉じる',

  // SettingsButton
  'settingsButton.a11y.open': '設定を開く',
};
