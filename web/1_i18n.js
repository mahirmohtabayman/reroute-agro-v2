/* =====================================================================
   Reroute Agro — Bangla / English language layer
   - Default: Bangla
   - Persists with localStorage key: reroute-lang
   - Works independently from light/dark theme
   - Translates rendered text, form labels/placeholders, dialogs, toasts,
     notifications and async AI output without duplicating pages.
   ===================================================================== */

const LANG_KEY = 'reroute-lang';

let APP_LANG = 'bn';

try {
  const savedLang = localStorage.getItem(LANG_KEY);

  if (
    savedLang === 'bn' ||
    savedLang === 'en'
  ) {
    APP_LANG = savedLang;
  }
} catch (e) {}


function curLang() {
  return APP_LANG;
}


function isEn() {
  return APP_LANG === 'en';
}


function langLocale() {
  return isEn()
    ? 'en-US'
    : 'bn-BD';
}


const BN_DIGITS = '০১২৩৪৫৬৭৮৯';


function enDigits(v) {

  return String(v).replace(
    /[০-৯]/g,
    d => String(
      BN_DIGITS.indexOf(d)
    )
  );

}


/* =========================================================
   Sentence / phrase translations
   ========================================================= */

const I18N_PHRASES = [

  [
    'কৃষকের মাল, পাইকারের বাজার',
    'Produce from farmers, market for wholesalers'
  ],

  [
    'সরাসরি কেনাবেচা ও দরদাম, নিরাপদ পেমেন্ট, আর নিজস্ব ট্রাকে কম খরচে পরিবহন।',
    'Trade and negotiate directly, pay securely, and move goods at lower cost with Reroute transport.'
  ],

  [
    'মাঝখানে দালাল নেই, কৃষক আর পাইকার নিজেরাই দাম ঠিক করেন।',
    'No middleman — farmers and wholesalers negotiate the price directly.'
  ],

  [
    'মাল বুঝে পাওয়া পর্যন্ত টাকা Reroute-এ জমা থাকে, তারপর বিক্রেতা পান।',
    'Money stays secured with Reroute until the goods are received, then the seller is paid.'
  ],

  [
    'শেয়ার্ড ট্রাকে মাল যায়, তাই বাজারের চেয়ে কম ভাড়ায় পৌঁছায়।',
    'Shared transport lowers delivery cost compared with hiring a truck independently.'
  ],

  [
    'কৃষক ও পাইকারের সরাসরি পাইকারি বাজার: দরদাম, নিরাপদ পেমেন্ট, নিজস্ব ট্রাক, মজুদ ও লাভ-ক্ষতির হিসাব',
    'A direct wholesale marketplace for farmers and wholesalers: negotiation, secure payments, transport, inventory and profit/loss tracking'
  ],

  [
    'কৃষক ও পাইকারের পাইকারি বাজার',
    'Wholesale marketplace for farmers and wholesalers'
  ],

  [
    'ডেমো নতুন করে শুরু করবেন?',
    'Restart the demo?'
  ],

  [
    'সব ডেমো ডেটা শুরুর অবস্থায় ফিরবে।',
    'All demo data will return to its initial state.'
  ],

  [
    'ডেমো নতুন করে শুরু হয়েছে',
    'The demo has been restarted'
  ],

  [
    'আপনার সেশন শেষ হয়েছে, আবার লগ ইন করুন',
    'Your session has expired. Please log in again.'
  ],

  [
    'সার্ভারের সাথে যোগাযোগ হচ্ছে না, একটু পরে চেষ্টা করুন',
    'Cannot connect to the server. Please try again shortly.'
  ],

  [
    'তথ্য ঠিকভাবে দিন',
    'Please enter the information correctly'
  ],

  [
    'কাজটি হয়নি, আবার চেষ্টা করুন',
    'The action could not be completed. Please try again.'
  ],

  [
    'এই পাতাটা পাওয়া গেল না',
    'Page not found'
  ],

  [
    'লিংকটা হয়তো ভুল, বা পাতাটা সরানো হয়েছে।',
    'The link may be incorrect or the page may have been moved.'
  ],

  [
    'শুরুতে ফিরুন',
    'Back to home'
  ],

  [
    'আপনি কে, বাছুন',
    'Choose your account type'
  ],

  [
    'ডেমো অ্যাকাউন্ট, এক চাপে ঢুকুন',
    'Demo accounts — enter with one click'
  ],

  [
    'শুধু কৃষক ও পাইকারদের জন্য পাইকারি প্ল্যাটফর্ম।',
    'A wholesale platform for farmers and wholesalers.'
  ],

  [
    'লগ ইন ছাড়াই বাজার দেখুন',
    'Browse the market without logging in'
  ],

  [
    'নতুন? অ্যাকাউন্ট খুলুন',
    'New here? Create an account'
  ],

  [
    'এই নম্বরে অ্যাকাউন্ট নেই। ডেমো অ্যাকাউন্ট বাছুন বা নতুন খুলুন।',
    'No account exists for this number. Choose a demo account or create a new one.'
  ],

  [
    'এই নম্বরে আগেই অ্যাকাউন্ট আছে, লগ ইন করুন',
    'An account already exists for this number. Please log in.'
  ],

  [
    'নাম আর ০১ দিয়ে শুরু ১১ সংখ্যার নম্বর দিন',
    'Enter a name and an 11-digit mobile number starting with 01'
  ],

  [
    'অ্যাকাউন্ট খোলা হয়েছে',
    'Account created successfully'
  ],

  [
    'এই খোঁজে কোনো মাল পাওয়া গেল না',
    'No produce matched your search'
  ],

  [
    'অন্য ফসল, জেলা বা দাম দিয়ে আবার দেখুন।',
    'Try another crop, district or price range.'
  ],

  [
    'সব ফিল্টার মুছুন',
    'Clear all filters'
  ],

  [
    'এই লিস্টিংটা আর নেই',
    'This listing is no longer available'
  ],

  [
    'হয়তো সব বিক্রি হয়ে গেছে, বা বিক্রেতা বন্ধ করে দিয়েছেন।',
    'It may be sold out or the seller may have closed it.'
  ],

  [
    'বাজারে ফিরুন',
    'Back to market'
  ],

  [
    'ছবি দেওয়া হয়নি',
    'No photo provided'
  ],

  [
    'বিক্রেতা ছবি দেননি',
    'The seller did not provide a photo'
  ],

  [
    'অফার দিতে লগ ইন করুন',
    'Log in to make an offer'
  ],

  [
    'এই মাল এখন বিক্রি হচ্ছে না।',
    'This produce is not currently for sale.'
  ],

  [
    'আগে মাল দেখতে চাই (ভিডিও / সরাসরি)',
    'Inspect before buying (video / in person)'
  ],

  [
    'অফার দিলে বিক্রেতা রাজি না হওয়া পর্যন্ত কিছু নিশ্চিত হয় না, টাকাও কাটে না।',
    'Nothing is confirmed and no money is charged until the seller accepts your offer.'
  ],

  [
    'ফোন নম্বর ও লেনদেনের বিস্তারিত গোপন। অর্ডারের পেমেন্ট হলে দুজনে নম্বর পান।',
    'Phone numbers and transaction details stay private. Both parties receive contact details after order payment.'
  ],

  [
    'এখন কোনো লিস্টিং নেই',
    'No active listings right now'
  ],

  [
    'এখনো রিভিউ নেই',
    'No reviews yet'
  ],

  [
    'আপনার কাজ আছে',
    'Action needed'
  ],

  [
    'কোনো অফার নেই',
    'No offers yet'
  ],

  [
    'বাজারে পছন্দের মালে অফার দিন। আপনার মালে কেউ অফার দিলেও এখানে দেখাবে।',
    'Make an offer on produce you like in the market. Offers received on your listings will also appear here.'
  ],

  [
    'কোনো পরিদর্শন নেই',
    'No inspections'
  ],

  [
    'কেনার আগে মাল দেখতে চাইলে লিস্টিংয়ের পাতা থেকে ভিডিও কল বা সরাসরি দেখার অনুরোধ করুন।',
    'To inspect produce before buying, request a video call or in-person inspection from the listing page.'
  ],

  [
    'মাল বুঝে পেয়েছি',
    'I received the goods'
  ],

  [
    'পাইকারকে মাল বুঝিয়ে দিয়েছি',
    'I handed the goods to the wholesaler'
  ],

  [
    'ট্রাকে মাল তুলে দিয়েছি',
    'I loaded the goods onto the truck'
  ],

  [
    'মাল পৌঁছালে ক্রেতা নিশ্চিত করবেন, তখন টাকা আপনার ওয়ালেটে যাবে।',
    'The buyer will confirm after delivery, then the money will move to your wallet.'
  ],

  [
    'Reroute ট্রাক ঠিক হলে চালকের নাম, নম্বর আর আসার সময় জানানো হবে। মাল তৈরি রাখুন।',
    'When the Reroute truck is assigned, you will receive the driver name, number and pickup time. Keep the goods ready.'
  ],

  [
    'আপনার টাকা Reroute-এ জমা আছে।',
    'Your money is secured with Reroute.'
  ],

  [
    'মালের খরচ দেওয়া নেই, তাই সঠিক লাভ বলা যাচ্ছে না।',
    'Produce cost is missing, so exact profit cannot be calculated.'
  ],

  [
    'মাল দেখেছি',
    'I inspected the goods'
  ],

  [
    'অনুরোধ বাতিল',
    'Cancel request'
  ],

  [
    'বুকিং পাওয়া যায়নি',
    'Booking not found'
  ],

  [
    'অফার পাওয়া যায়নি',
    'Offer not found'
  ],

  [
    'অর্ডার পাওয়া যায়নি',
    'Order not found'
  ],

  [
    'পাওয়া যায়নি',
    'Not found'
  ],

  [
    'বুকিং অনুরোধ',
    'Booking requested'
  ],

  [
    'বুকিং নিশ্চিত',
    'Booking confirmed'
  ],

  [
    'মাল তোলার সময় ঠিক',
    'Pickup scheduled'
  ],

  [
    'মাল তোলার সময়',
    'Pickup time'
  ],

  [
    'মাল ট্রাকে উঠেছে, পথে আছে।',
    'Goods have been loaded and are in transit.'
  ],

  [
    'মাল গন্তব্যে পৌঁছে গেছে।',
    'Goods have reached the destination.'
  ],

  [
    'ক্রেতার পেমেন্টের অপেক্ষা।',
    'Waiting for buyer payment.'
  ],

  [
    'পেমেন্ট হলে অর্ডার নিশ্চিত হবে',
    'The order will be confirmed after payment'
  ],

  [
    'রাজি হলে পেমেন্ট করুন',
    'If you accept, proceed to payment'
  ],

  [
    'অফার তুলে নিন',
    'Withdraw offer'
  ],

  [
    'দরদামের ইতিহাস',
    'Negotiation history'
  ],

  [
    'মেয়াদ শেষ',
    'Expired'
  ],

  [
    'পেমেন্ট বাকি',
    'Payment pending'
  ],

  [
    'অর্ডার নিশ্চিত',
    'Order confirmed'
  ],

  [
    'মাল হস্তান্তর হয়েছে',
    'Goods handed over'
  ],

  [
    'বিক্রেতা রাজি',
    'Seller accepted'
  ],

  [
    'পেমেন্ট ও অর্ডার নিশ্চিত',
    'Payment & order confirmed'
  ],

  [
    'মাল হস্তান্তর',
    'Handover'
  ],

  [
    'বুকিং তৈরি, পেমেন্ট বাকি',
    'Booking created; payment pending'
  ],

  [
    'পেমেন্টের পর বুকিং অনুরোধ',
    'Booking requested after payment'
  ],

  [
    'অর্ডারের পেমেন্টের সাথে বুকিং হয়েছে',
    'Transport booked with order payment'
  ],

  [
    'অর্ডার বাতিল হয়েছে',
    'Order cancelled'
  ],

  [
    'সময়মতো পেমেন্ট হয়নি',
    'Payment was not made in time'
  ],

  [
    'লিস্টিং প্রকাশ করবেন?',
    'Publish this listing?'
  ],

  [
    'প্রকাশ হলে সব কৃষক ও পাইকার দেখতে পাবেন।',
    'Once published, all farmers and wholesalers can see it.'
  ],

  [
    'লিস্টিং প্রকাশ হয়েছে',
    'Listing published'
  ],

  [
    'জরুরি বিক্রি চালু করবেন?',
    'Enable urgent sale?'
  ],

  [
    'জরুরি বিক্রি চালু, পাইকারদের জানানো হয়েছে',
    'Urgent sale enabled and wholesalers have been notified'
  ],

  [
    'চলমান অফার আর অর্ডারের দাম বদলাবে না।',
    'Existing offers and orders will keep their current prices.'
  ],

  [
    'দাম বদলানো হয়েছে',
    'Price updated'
  ],

  [
    'পরিমাণ বাড়ান বা কমান',
    'Increase or decrease quantity'
  ],

  [
    'পরিমাণ বদলানো হয়েছে',
    'Quantity updated'
  ],

  [
    'বন্ধ থাকলে কেউ নতুন অফার দিতে পারবেন না। পরে আবার চালু করা যাবে।',
    'No new offers can be made while paused. You can activate it again later.'
  ],

  [
    'সবাই আবার দেখতে ও অফার দিতে পারবেন।',
    'Everyone can view it and make offers again.'
  ],

  [
    'অফার পাঠাবেন?',
    'Send this offer?'
  ],

  [
    'বিক্রেতা রাজি হলে পেমেন্ট করতে বলা হবে। এখন কোনো টাকা কাটবে না।',
    'You will be asked to pay only after the seller accepts. No money is charged now.'
  ],

  [
    'অফার পাঠানো হয়েছে',
    'Offer sent'
  ],

  [
    'পাল্টা দাম পাঠাবেন?',
    'Send a counteroffer?'
  ],

  [
    'পাল্টা দাম পাঠানো হয়েছে',
    'Counteroffer sent'
  ],

  [
    'মাল হাতে পেয়েছেন?',
    'Have you received the goods?'
  ],

  [
    'নিশ্চিত করলে বিক্রেতা টাকা পাবেন, আর এটা ফেরানো যাবে না।',
    'After confirmation, the seller will be paid and this action cannot be reversed.'
  ],

  [
    'অর্ডার সম্পূর্ণ হয়েছে',
    'Order completed'
  ],

  [
    'পেমেন্ট সফল',
    'Payment successful'
  ],

  [
    'পেমেন্ট হয়নি',
    'Payment failed'
  ],

  [
    'আবার চেষ্টা',
    'Try again'
  ],

  [
    'পরে করব',
    'Do it later'
  ],

  [
    'পেমেন্ট করুন',
    'Pay now'
  ],

  [
    'ব্যালান্স যথেষ্ট নয়',
    'Insufficient balance'
  ],

  [
    'কার্ড নম্বর (১৬ সংখ্যা)',
    'Card number (16 digits)'
  ],

  [
    'ডেবিট/ক্রেডিট কার্ড',
    'Debit/Credit Card'
  ],

  [
    'ভিসা, মাস্টারকার্ড',
    'Visa, Mastercard'
  ],

  [
    'মোবাইল নম্বর ও পিন',
    'Mobile number and PIN'
  ],

  [
    'কার্ড পেমেন্ট',
    'Card payment'
  ],

  [
    'মোট ট্রাক ভাড়া',
    'Total transport cost'
  ],

  [
    'Reroute সেবা চার্জ',
    'Reroute service fee'
  ],

  [
    'আপনার কাছে আনার খরচ (আনুমানিক)',
    'Estimated delivery cost to you'
  ],

  [
    'বিক্রির জন্য আছে',
    'Available for sale'
  ],

  [
    'অর্ডারে আটকে আছে',
    'Reserved in orders'
  ],

  [
    'এ পর্যন্ত বিক্রি',
    'Sold so far'
  ],

  [
    'সর্বনিম্ন অর্ডার',
    'Minimum order'
  ],

  [
    'তোলা হয়েছে',
    'Harvested'
  ],

  [
    'তাজা থাকবে',
    'Fresh for'
  ],

  [
    'Reroute ট্রাক বা নিজের ট্রাক',
    'Reroute transport or own truck'
  ],

  [
    'আজকের বাজার দর আনুমানিক',
    'Estimated market price today'
  ],

  [
    'ডেমো অনুমান',
    'Demo estimate'
  ],

  [
    'জরুরি বিক্রি',
    'Urgent sale'
  ],

  [
    'নষ্ট হওয়ার আগে',
    'before spoilage'
  ],

  [
    'লিস্টিং পরিচালনা',
    'Manage listing'
  ],

  [
    'সম্পূর্ণ লেনদেন',
    'Completed transactions'
  ],

  [
    'মোট পরিমাণ',
    'Total quantity'
  ],

  [
    'বাতিল করেছেন',
    'Cancelled'
  ],

  [
    'যাচাই হয়নি',
    'Not verified'
  ],

  [
    'চালু লিস্টিং',
    'Active listings'
  ],

  [
    'AI পরামর্শ',
    'AI Advice'
  ],

  [
    'কোথায় বেচবেন',
    'Where to sell'
  ],

  [
    'কোথায় কিনবেন',
    'Where to buy'
  ],

  [
    'বাজারের অবস্থা',
    'Market overview'
  ],

  [
    'মূল পরামর্শ',
    'Key Recommendation'
  ],

  [
    'AI হিসাব করছে...',
    'AI is calculating...'
  ],

  [
    'সবচেয়ে লাভ',
    'Best return'
  ],

  [
    'লাভ বেশি',
    'Higher return'
  ],

  [
    'স্থানীয় হাট',
    'Local market'
  ],

  [
    'কম পাবেন',
    'Lower return'
  ],

  [
    'উৎপাদন খরচ বাদে আনুমানিক লাভ',
    'Estimated profit after production cost'
  ],

  [
    'হাতে থাকবে আনুমানিক',
    'Estimated net amount'
  ],

  [
    'পরিবহনে বাধা চলছে',
    'Transport disruption is affecting supply'
  ],

  [
    'উৎসবের সময়, চাহিদা বেশি',
    'Festival period; demand is high'
  ],

  [
    'এই ফসলের লিস্টিং নেই।',
    'There are no listings for this crop.'
  ],

  ['মজুদ ও হিসাব','Inventory & Accounts'],
  ['দাম ও পরামর্শ','Price & Advice'],
  ['পয়েন্ট ও ওয়ালেট','Points & Wallet'],
  ['অফার ও অর্ডার','Offers & Orders'],
  ['আমার লিস্টিং','My Listings'],
  ['ট্রাক বুকিং','Truck Bookings'],
  ['ট্রাক বহর','Truck Fleet'],
  ['অপারেশন টিম','Operations Team'],

  ['সব পড়া হয়েছে','Mark all as read'],
  ['কোনো নোটিফিকেশন নেই','No notifications'],
  ['মেনু বন্ধ','Close menu'],

  ['ডেমো নতুন করে শুরু','Restart demo'],
  ['ডেমো সংস্করণ','Demo version'],

  ['সরাসরি দরদাম','Direct negotiation'],
  ['নিরাপদ পেমেন্ট','Secure payment'],
  ['নিজস্ব ট্রাক','Reroute transport'],

  ['আমি কৃষক','I am a Farmer'],
  ['আমি পাইকার','I am a Wholesaler'],

  ['নতুন অ্যাকাউন্ট','Create account'],
  ['আড়ত / ব্যবসার নাম','Business / trading-house name'],
  ['উপজেলা / বাজার','Upazila / market'],
  ['মোবাইল নম্বর','Mobile number'],
  ['অ্যাকাউন্ট খুলুন','Create account'],

  ['প্রোফাইল যাচাই','Profile verification'],
  ['জাতীয় পরিচয়পত্র','National ID'],
  ['ট্রেড লাইসেন্স','Trade license'],

  ['অন্তত কত মণ','Minimum quantity (maund)'],
  ['মাল কোথায় আছে','Produce location'],
  ['আপনার বাজার','Your market'],
  ['কত মণ','Quantity (maund)'],
  ['আর কত দিন তাজা থাকবে','Freshness remaining'],
  ['ফসল অনুযায়ী','Use crop estimate'],

  [
    'উৎপাদন খরচ ৳/কেজি (ঐচ্ছিক)',
    'Production cost ৳/kg (optional)'
  ],

  ['প্রত্যাশিত দাম','Expected price'],
  ['হাতে থাকবে','Estimated net'],
  ['স্থানীয় হাটে','Local market'],

  ['কোন বাজারে কত থাকবে','Market comparison'],
  ['দাম/কেজি','Price/kg'],
  ['স্থানীয়ের চেয়ে','vs local'],

  [
    'কোন দিন পাঠালে কত থাকবে',
    'Net amount by send day'
  ],

  ['কেনার দাম','Purchase price'],
  ['পৌঁছে খরচ','Landed cost'],

  [
    '৮% লাভে সর্বোচ্চ কেনা',
    'Maximum buy price for 8% margin'
  ],

  ['লাভ/কেজি','Profit/kg'],
  ['মোট লাভ','Total profit'],

  [
    'এখন উৎস পাওয়া যায়নি',
    'No suitable sources found right now'
  ],

  ['কাল পাঠান','Send tomorrow'],
  ['পরশু পাঠান','Send the day after tomorrow'],

  ['উত্তরের অপেক্ষা','Awaiting response'],
  ['পাল্টা দাম এসেছে','Counteroffer received'],

  ['রাজি হননি','Declined'],

  [
    'ছবি ও মানের তথ্য',
    'Photo and quality information'
  ],

  ['বিক্রির টাকা','Sale proceeds'],
  ['খরচ বাদে হাতে এসেছে','Net after costs'],

  ['মার্চেন্ট:','Merchant:'],
  ['পেছনে','Back'],
  ['ঠিক আছে','OK'],
  ['নিশ্চিত করুন','Confirm'],

  ['কারণ ছাড়া','Without a reason'],
  ['একটি কারণ দিন','Provide a reason'],
  ['কিছু লিখুন','Write something'],

  [
    'ছোট মন্তব্য (ঐচ্ছিক)',
    'Short comment (optional)'
  ],

  ['রেটিং দিন','Submit rating'],

  ['আরও','More'],
  ['বের হন','Log out'],
  ['লগ ইন','Log in'],

  ['সংরক্ষণ হয়েছে','Saved successfully'],
  ['প্রোফাইল সংরক্ষণ হয়েছে','Profile saved'],
  ['হালনাগাদ হয়েছে','Updated successfully'],
  ['অনুরোধ পাঠানো হয়েছে','Request sent'],

  ['আজ বিকেল ৪টা','Today at 4 PM'],
  ['যেকোনো সময়','Any time'],

  ['ডেমো গেটওয়ে','Demo gateway'],

  [
    'বিকাশ, নগদ, কার্ড বা ওয়ালেট',
    'bKash, Nagad, card or wallet'
  ],

  ['ফোনে দেখুন','View on phone'],

  ['প্রতি কেজি','per kg'],
  ['কেজি প্রতি','per kg'],
  ['প্রতি মণ','per maund'],

  [
    'এই দামে বিক্রি করবেন?',
    'Sell at this price?'
  ],

  [
    'পাল্টা দামে কিনবেন?',
    'Buy at the counter price?'
  ],

  [
    'রাজি হয়ে সময় জানাবেন?',
    'Accept and set a time?'
  ],

  [
    'পরিদর্শনে রাজি নন?',
    'Decline inspection?'
  ],

  [
    'মাল দেখা হয়েছে?',
    'Has the produce been inspected?'
  ],

  [
    'অনুরোধ বাতিল করবেন?',
    'Cancel the request?'
  ],

  [
    'বুকিং বাতিল করবেন?',
    'Cancel the booking?'
  ],

  ['বুকিং বাতিল হয়েছে','Booking cancelled'],
  ['ট্রাক যোগ হয়েছে','Truck added'],

  [
    'প্রোফাইল যাচাই করবেন?',
    'Verify this profile?'
  ],

  [
    'Reroute প্লাস নেবেন?',
    'Subscribe to Reroute Plus?'
  ],

  [
    'প্লাস বন্ধ করবেন?',
    'Cancel Plus renewal?'
  ],

  [
    'প্লাস নবায়ন আবার চালু করবেন?',
    'Resume Plus renewal?'
  ],

  [
    'প্লাস চালু থাকবে',
    'Plus will remain active'
  ],

  [
    'প্লাস বন্ধ করা হয়েছে, মেয়াদ পর্যন্ত চালু থাকবে',
    'Plus renewal is off; benefits remain active until expiry'
  ],

  [
    'নতুন দাম (৳/কেজি)',
    'New price (৳/kg)'
  ],

  [
    'কত মণ যোগ করবেন?',
    'How many maunds to add?'
  ],

  [
    'কমাতে মাইনাস দিন',
    'use a minus value to reduce'
  ],

  [
    'সাময়িক বন্ধ করবেন?',
    'Pause this listing?'
  ],

  [
    'আবার চালু করবেন?',
    'Activate again?'
  ],

  [
    'লিস্টিং পুরো বন্ধ করবেন?',
    'Close this listing?'
  ],

  ['শেয়ার্ড ট্রাক','Shared truck'],
  ['নিজের ট্রাক','Own truck'],
  ['নিজে নেব','Self pickup'],

  ['ভিডিও কল','Video call'],
  ['সরাসরি দেখব','Inspect in person'],

  ['আপনি পাবেন','You receive'],
  ['মোট পেমেন্ট','Total payment'],
  ['আপনার ভাগ','Your share'],

  [
    'ট্রাক ভাড়া, আপনার ভাগ',
    'Transport, your share'
  ],

  [
    'প্ল্যাটফর্ম ফি ১%',
    'Platform fee 1%'
  ],

  ['আপনার ওয়ালেট','Your wallet'],
  ['ওয়ালেট ব্যালান্স','Wallet balance'],
  ['লেনদেন নম্বর','Transaction ID'],

  [
    'মাল বুঝে পেলে',
    'after receiving the goods'
  ],

  ['খুব ভালো','Very good'],
  ['ভালো','Good'],
  ['মোটামুটি','Fair'],
  ['খারাপ','Poor'],
  ['খুব খারাপ','Very poor'],

  [
    'নিরাপত্তা ও গোপনীয়তা',
    'Security & Privacy'
  ],

  ['প্রোফাইল তথ্য','Profile Information'],
  ['ব্যবসার তথ্য','Business Information'],
  ['অ্যাকাউন্ট তথ্য','Account Information'],

  [
    'Reroute Agro · Social Catalyst | ডেমো সংস্করণ',
    'Reroute Agro · Social Catalyst | Demo version'
  ]

].sort(
  (a,b) =>
    b[0].length - a[0].length
);


/* =========================================================
   Word fallback
   ========================================================= */

const I18N_WORDS = {

  'ড্যাশবোর্ড':'Dashboard',
  'হোম':'Home',

  'বাজার':'Market',
  'বাজারে':'market',
  'বাজারের':'market',
  'বাজারদর':'market price',

  'লিস্টিং':'Listing',
  'লিস্টিংটা':'listing',

  'লেনদেন':'Transactions',
  'পরিবহন':'Transport',

  'অ্যাকাউন্ট':'Account',
  'প্রোফাইল':'Profile',

  'কৃষক':'Farmer',
  'কৃষকের':'farmer’s',

  'পাইকার':'Wholesaler',
  'পাইকারের':'wholesaler’s',
  'পাইকারকে':'wholesaler',
  'পাইকারদের':'wholesalers',

  'বিক্রেতা':'Seller',
  'বিক্রেতার':'seller’s',

  'ক্রেতা':'Buyer',
  'ক্রেতার':'buyer’s',

  'ব্যবহারকারী':'Users',
  'অপারেশন':'Operations',
  'টিম':'Team',

  'অফার':'Offer',

  'অর্ডার':'Order',
  'অর্ডারের':'order',
  'অর্ডারে':'order',

  'বুকিং':'Booking',

  'ট্রাক':'Truck',
  'ট্রাকে':'truck',
  'ট্রাকের':'truck',

  'মাল':'goods',
  'মালের':'goods',

  'ফসল':'Crop',

  'দাম':'Price',
  'দামে':'price',
  'দর':'price',

  'পরিমাণ':'Quantity',

  'খরচ':'Cost',

  'লাভ':'Profit',
  'লোকসান':'Loss',
  'ক্ষতি':'Loss',

  'মজুদ':'Inventory',
  'হিসাব':'Accounts',

  'ওয়ালেট':'Wallet',
  'ওয়ালেটে':'wallet',

  'পয়েন্ট':'Points',
  'ক্যাশব্যাক':'Cashback',

  'প্লাস':'Plus',
  'প্ল্যাটফর্ম':'Platform',

  'ফি':'Fee',
  'সেবা':'Service',
  'চার্জ':'Charge',

  'চালু':'Active',
  'চলমান':'Ongoing',
  'বন্ধ':'Paused',
  'বাতিল':'Cancelled',
  'সম্পূর্ণ':'Completed',

  'সফল':'Successful',
  'ব্যর্থ':'Failed',
  'অপেক্ষমাণ':'Pending',
  'নিশ্চিত':'Confirmed',
  'অনুরোধ':'Request',
  'পরিদর্শন':'Inspection',

  'জরুরি':'Urgent',
  'স্থানীয়':'Local',

  'শেয়ার্ড':'Shared',

  'নিজে':'Self',
  'নিজের':'own',
  'নিজস্ব':'own',

  'নতুন':'New',
  'পুরো':'Full',
  'অর্ধেক':'Half',

  'তালিকার':'listing',
  'বাইরে':'outside',

  'আজ':'Today',
  'কাল':'Tomorrow',
  'পরশু':'Day after tomorrow',
  'আগামীকাল':'Tomorrow',
  'গতকাল':'Yesterday',

  'এখন':'Now',
  'এখনো':'Still',

  'আগে':'ago',
  'পরে':'later',

  'দিন':'days',
  'মাস':'months',
  'ঘণ্টা':'hours',
  'মিনিট':'minutes',

  'সময়':'Time',
  'মেয়াদ':'Expiry',
  'শুরু':'Start',
  'শেষ':'End',

  'কেজি':'kg',
  'মণ':'maund',
  'কিমি':'km',

  'টাকা':'BDT',
  'টি':'',

  'সংখ্যা':'number',
  'নম্বর':'Number',
  'মোবাইল':'Mobile',
  'পিন':'PIN',

  'মোট':'Total',
  'প্রতি':'per',

  'সর্বনিম্ন':'Minimum',
  'সর্বোচ্চ':'Maximum',

  'আনুমানিক':'Estimated',
  'প্রায়':'about',
  'গড়':'average',
  'অন্তত':'at least',

  'বিক্রি':'Sell',
  'বিক্রির':'sale',
  'বেচলে':'if sold',

  'কেনা':'Buy',
  'কিনুন':'Buy',
  'কিনবেন':'buy',
  'কিনতে':'buy',
  'বেচবেন':'sell',

  'পাঠান':'Send',
  'পাঠালে':'if sent',
  'পাঠাবেন':'send',

  'তোলা':'pickup',
  'তোলার':'pickup',
  'তুলে':'loaded',

  'পৌঁছেছে':'Delivered',
  'পৌঁছে':'delivered',

  'পথে':'In transit',

  'হস্তান্তর':'Handover',

  'ফেরত':'Refund',

  'জমা':'secured',
  'কাটা':'deducted',

  'পেমেন্ট':'Payment',
  'নগদ':'Nagad',
  'বিকাশ':'bKash',
  'কার্ড':'Card',
  'ব্যালান্স':'Balance',

  'নাম':'Name',
  'জেলা':'District',
  'এলাকা':'Area',
  'উপজেলা':'Upazila',

  'ছবি':'Photo',
  'মান':'Quality',
  'গ্রেড':'Grade',

  'রিভিউ':'Reviews',
  'রেটিং':'Rating',

  'যাচাই':'Verify',
  'যাচাইকৃত':'Verified',

  'জাতীয়':'National',
  'পরিচয়পত্র':'ID',
  'লাইসেন্স':'License',

  'চালক':'Driver',
  'চালকের':'driver’s',
  'গাড়ির':'vehicle',

  'সব':'All',
  'সবাই':'Everyone',
  'কোনো':'Any',
  'কিছু':'Some',
  'আরও':'More',
  'অন্য':'Other',
  'শুধু':'Only',

  'এই':'This',
  'এখানে':'Here',

  'কাছ':'near',
  'কাছে':'to',
  'থেকে':'from',
  'পর্যন্ত':'until',

  'দেখুন':'View',
  'দেখতে':'view',
  'দেখাবে':'show',
  'দেখে':'viewing',

  'ফিরুন':'Back',
  'ঢুকুন':'Enter',
  'বের':'Logout',

  'লগ':'Log',
  'ইন':'in',

  'সংরক্ষণ':'Save',
  'প্রকাশ':'Publish',
  'বদলান':'Change',
  'যোগ':'Add',
  'সরান':'Remove',
  'মুছুন':'Clear',

  'খুঁজুন':'Search',
  'ফিল্টার':'Filter',
  'সাজান':'Sort',

  'তথ্য':'Information',
  'বিবরণ':'Description',
  'কারণ':'Reason',
  'অবস্থা':'Status',
  'ধরন':'Type',

  'ডেটা':'Data',
  'মডেল':'Model',
  'পরামর্শ':'Advice',

  'অনুমান':'estimate',
  'আসল':'real',
  'ডেমো':'Demo',

  'আমার':'My',
  'আপনার':'Your',
  'আপনি':'You',
  'আমি':'I',
  'আমাদের':'Our',
  'তাদের':'Their',

  'কে':'to',
  'এর':'of',

  'আর':'and',
  'ও':'and',
  'বা':'or',

  'জন্য':'for',
  'সাথে':'with',
  'মধ্যে':'between',
  'অনুযায়ী':'according to',

  'বেশি':'more',
  'কম':'less',

  'ভালো':'good',
  'সেরা':'Best',

  'ঠিক':'correct',
  'ভুল':'incorrect',

  'তাজা':'fresh',
  'নষ্ট':'spoil',

  'দ্রুত':'quickly',
  'জরুরিভাবে':'urgently',

  'আছে':'available',
  'নেই':'none',
  'হবে':'will be',
  'হয়েছে':'has been',
  'হয়নি':'not completed',
  'হচ্ছে':'is happening',
  'থাকবে':'will remain',
  'পাবেন':'will receive',
  'যাবে':'will go',
  'গেছে':'has gone',
  'যায়':'goes',
  'হয়':'is',
  'নয়':'not',
  'ছিল':'was',

  'করুন':'Please',
  'করবেন':'will you',
  'করলে':'if you do',
  'করতে':'to do',
  'করা':'done',
  'করে':'by',
  'করেছেন':'did',

  'দিতে':'to give',
  'দেওয়া':'provided',
  'দিয়েছেন':'provided',
  'দিলে':'if given',
  'দেবেন':'will give',

  'নিন':'take',
  'রাখুন':'keep',
  'রাখা':'keep',

  'বুঝে':'received',
  'জানানো':'notified',

  'পান':'receive',
  'চান':'want',
  'পারবেন':'can',

  'রাজি':'Accept',
  'পাল্টা':'Counter',
  'উত্তর':'Response',
  'অপেক্ষা':'Waiting',

  'অগ্রাধিকার':'Priority',
  'অগ্রিম':'Advance',

  'উৎপাদন':'Production',
  'হাতে':'net',
  'তুলনা':'Comparison',

  'পূর্বাভাস':'Forecast',
  'আমদানি':'Arrivals',
  'চাহিদা':'Demand',
  'উৎস':'Source',
  'উৎসবের':'festival',
  'বাধা':'disruption',

  'লাইট':'Light',
  'ডার্ক':'Dark',
  'মোড':'mode',

  'মেনু':'Menu',
  'নোটিফিকেশন':'Notifications',

  'লোড':'Loading',
  'সার্ভার':'Server',

  'ভিডিও':'Video',
  'সরাসরি':'Direct',
  'কল':'call',

  'টমেটো':'Tomato',
  'টমেটোর':'Tomato',

  'বেগুন':'Eggplant',
  'বেগুনের':'Eggplant',

  'কাঁচা':'Green',

  'মরিচ':'chili',
  'মরিচের':'chili',

  'শসা':'Cucumber',
  'শসার':'Cucumber',

  'গাজর':'Carrot',
  'গাজরের':'Carrot',

  'পেঁয়াজ':'Onion',
  'পেঁয়াজের':'Onion',

  'আলু':'Potato',
  'আলুর':'Potato',

  'চাল':'Rice',
  'চালের':'Rice',

  'মসুর':'Lentil',

  'ডাল':'lentils',
  'ডালের':'lentils',

  'ভোজ্য':'Edible',

  'তেল':'oil',
  'তেলের':'oil',

  'আটা':'Flour',
  'আটার':'Flour',

  'রাজশাহী':'Rajshahi',
  'রাজশাহীতে':'Rajshahi',
  'রাজশাহীর':'Rajshahi',

  'নাটোর':'Natore',
  'নাটোরে':'Natore',
  'নাটোরের':'Natore',

  'নওগাঁ':'Naogaon',
  'নওগাঁয়':'Naogaon',
  'নওগাঁর':'Naogaon',

  'চাঁপাইনবাবগঞ্জ':'Chapainawabganj',
  'চাঁপাইনবাবগঞ্জে':'Chapainawabganj',
  'চাঁপাইনবাবগঞ্জের':'Chapainawabganj',

  'বগুড়া':'Bogura',
  'বগুড়ায়':'Bogura',
  'বগুড়ার':'Bogura',

  'ঢাকা':'Dhaka',
  'ঢাকায়':'Dhaka',
  'ঢাকার':'Dhaka',

  'জানু':'Jan',
  'ফেব্রু':'Feb',
  'মার্চ':'Mar',
  'এপ্রি':'Apr',
  'মে':'May',
  'জুন':'Jun',
  'জুলা':'Jul',
  'আগ':'Aug',
  'সেপ্টে':'Sep',
  'অক্টো':'Oct',
  'নভে':'Nov',
  'ডিসে':'Dec',

  'কোথায়':'Where',
  'কীভাবে':'How',
  'কী':'What',
  'কোন':'Which',
  'কত':'How much',
  'কখন':'When',
  'কেন':'Why',

  'হ্যাঁ':'Yes',
  'না':'No',

  'তাই':'therefore',
  'যেমন':'such as',
  'যদি':'if',
  'তবে':'then',
  'যত':'as much',
  'এত':'this much',

  'পাওয়া':'found',
  'দিয়েছি':'gave',
  'পেয়েছি':'received',
  'জানেন':'know',
  'জানা':'known',

  'ঐচ্ছিক':'optional',

  'দুজনে':'both parties',
  'গোপন':'private',
  'নিরাপদ':'secure',
  'পাইকারি':'wholesale',
  'দালাল':'middleman',

  'বাড়তে':'increase',
  'কমতে':'decrease',

  'চাপে':'under pressure',
  'শক্ত':'firm',
  'বেশ':'high',

  'কমেছে':'decreased',
  'বেড়েছে':'increased',
  'স্থিতিশীল':'stable',

  'শতাংশ':'percent',

  'ভাড়া':'Fare',
  'ভাড়ায়':'fare',
  'ভাড়ার':'fare',

  'ভাগ':'share',

  'নিজেদের':'their own',

  'মেরামতে':'Maintenance',
  'খালি':'Available',
  'বুক':'Booked',

  'সারাংশ':'Summary',
  'বহর':'Fleet',

  'ব্যবসার':'Business',
  'আড়ত':'Trading house',
  'পণ্য':'Product',

  'যোগাযোগ':'Contact',
  'নিরাপত্তা':'Security',
  'গোপনীয়তা':'Privacy',

  'স্বাগতম':'Welcome',
  'পরিশোধ':'Paid',
  'মার্চেন্ট':'Merchant',
  'গেটওয়ে':'Gateway',

  'তারকা':'stars',
  'মন্তব্য':'comment',
  'ছোট':'short',
  'চিপ':'chip',
  'কাগজপত্র':'documents',

  'হলে':'if',
  'ছাড়':'discount',
  'এ':'in',

  'আসে':'comes',
  'পরের':'next',
  'থাকলে':'if available',

  'যান':'go',
  'খবর':'notice',
  'আবার':'again',

  'পেমেন্টে':'to payment',
  'কারণসহ':'with reason',

  'দিয়ে':'with',
  'হতে':'to be',
  'পারে':'may',
  'চেয়ে':'than',

  'লিখুন':'write',

  'বিক্রিতে':'in sale',
  'আয়':'income',
  'কমিশন':'commission',
  'আলাদা':'separate',

  'হওয়া':'being',
  'আসবে':'will come',
  'আগের':'previous',

  'দামের':'price',
  'সাশ্রয়':'savings',

  'জায়গা':'place',

  'কৃষি':'Agriculture',
  'বিপণন':'Marketing',
  'অধিদপ্তরের':'Department',

  'একই':'same',
  'লাগবে':'needed',
  'বাকি':'remaining',
  'মজুদে':'inventory',

  'হয়েছেন':'have been',
  'অফারে':'offer',

  'বলুন':'tell',
  'নেবেন':'take',

  'ঠিকানা':'Address',

  'তারপর':'then',
  'কাজ':'work',

  'কিনলে':'if bought',

  'আটকে':'reserved',

  'সাইজ':'size',
  'তালিকায়':'list',
  'দরকার':'needed',

  'সিমুলেটেড':'Simulated',
  'দেখা':'viewed',

  'হওয়ার':'being',
  'কার':'whose',
  'অন্যান্য':'Other',
  'এন্ট্রি':'Entry',
  'কিনে':'buying',
  'পর':'after',
  'দূরত্ব':'Distance',

  'প্ল্যাটফর্মের':'platform',
  'সাবস্ক্রিপশন':'Subscription',

  'সকাল':'morning',
  'রওনা':'departure',

  'মালিক':'Owner',
  'মালিকের':'owner’s',

  'ব্যবস্থাপনা':'Management',
  'প্রতিটি':'each',
  'ধাপে':'step',

  'বুকিংয়ের':'booking',

  'গাড়ি':'Vehicle',
  'সার্ভিস':'Service',
  'তারিখ':'Date',

  'চলছে':'In progress',

  'সবজি':'vegetables',

  'পৌঁছাতে':'to deliver',
  'চাইলে':'if desired',

  'বাড়বে':'will increase',
  'কমবে':'will decrease',

  'লাল':'red',
  'চলবে':'will continue',

  'পারব':'can',

  'করেছি':'did',
  'কিনেছি':'bought',

  'হয়ে':'becoming',

  'চাপুন':'press',

  'কমে':'decreases',

  'পেমেন্টের':'payment',

  'বলবেন':'will tell',

  'অন্যজনকে':'the other party',
  'বিক্রেতাকে':'seller',

  'কাটবে':'will deduct',

  'বুঝিয়ে':'handed over',
  'পেয়েছেন':'received',

  'এটা':'this',
  'টাকার':'money',
  'যা':'which',

  'হলেই':'once',

  'দিনের':'days',

  'পড়া':'read',

  'যায়নি':'did not go',

  'কয়েক':'a few',
  'আসছে':'coming',
  'তৈরি':'ready',

  'পৌঁছালে':'when delivered',
  'চাপলে':'when pressed',
  'এলে':'when received',

  'বিস্তারিত':'Details',

  'থেকেই':'from',
  'সাময়িক':'Temporary',
  'কবে':'When',
  'রং':'Color',

  'পারেন':'can',
  'নিয়মিত':'Regular',

  'তবেই':'only then',

  'আনবেন':'bring',

  'কেনার':'purchase',

  'গিয়ে':'going',

  'ধাপ':'Step',

  'থাকে':'stays',
  'মানে':'means',

  'দিনে':'days',

  'বসবে':'will be used',
  'বদলায়':'changes',

  'চূড়ান্ত':'Final',

  'কেনাবেচার':'trading',
  'ইতিহাস':'History',

  'আজকের':'today’s',
  'এলাকার':'area',

  'শুনুন':'Listen',

  'বেচার':'selling',
  'দেন':'give',

  'ব্যবহার':'Use',
  'সপ্তাহে':'per week',

  'পাচ্ছেন':'receiving',
  'চার্জে':'charge',

  'সহ':'with',
  'অন্যরা':'Others',

  'যেভাবে':'as',
  'ঘণ্টার':'hours',

  'সিস্টেম':'System',
  'নিয়ে':'with',
  'আসুন':'come',
  'দিচ্ছেন':'providing',

  'কেনাবেচা':'Trading',
  'কৃষকদের':'farmers',
  'নিট':'Net',

  'এক':'one',
  'লেনদেনে':'transaction',
  'একটাই':'only one',

  'সেবার':'service',
  'এসক্রোতে':'escrow',
  'সাম্প্রতিক':'Recent',

  'কীসের':'What kind',
  'পদ্ধতি':'Method',

  'উঠেছে':'increased',
  'অপেক্ষায়':'waiting',
  'চলে':'runs',

  'ভিত্তি':'basis',

  'কিমিতে':'km',

  'ট্রিপ':'Trip',
  'কোম্পানি':'Company',
  'ঘাঁটি':'Base',

  'রহিম':'Rahim',
  'উদ্দিন':'Uddin',
  'করিমা':'Karima',
  'বেগম':'Begum',
  'হালিমা':'Halima',
  'খাতুন':'Khatun',
  'করিম':'Karim',

  'ট্রেডার্স':'Traders',
  'ফ্রেশ':'Fresh',
  'হাব':'Hub',

  'সদস্য':'Member',

  'ঘর':'Home',

  'বেচতে':'sell',
  'কাছের':'nearby',
  'দেখাও':'show',
  'ধরে':'assuming',

  'চার্ট':'Chart',
  'ডেটায়':'data',

  'প্রশিক্ষিত':'trained',
  'প্রশিক্ষণ':'training',
  'অদেখা':'unseen',

  'সময়ে':'time',
  'পরীক্ষা':'test',
  'সঠিক':'accurate',
  'সাধারণ':'general',

  'অনুমানে':'estimate',
  'মাসে':'months',

  'কালো':'black',
  'সবুজ':'green',
  'ডটেড':'dotted',

  'মডেলের':'model',
  'ডেটাসেটে':'dataset',
  'অ্যাপের':'app',

  'জায়গায়':'place',
  'পাঠাতে':'send',

  'করেননি':'did not',
  'সময়মতো':'on time',

  'মূল্য':'Value',

  'বদলাতে':'change',
  'সংরক্ষিত':'reserved',

  'এখনই':'now',
  'অনলাইনে':'online',

  'বলা':'said',
  'প্রত্যাখ্যান':'Reject',

  'এবং':'and',
  'নিলে':'if taken',

  'ফেরানো':'reversed',
  'তাঁর':'their',

  'বুকিংও':'booking too',

  'ভাবে':'way',

  'টাকাও':'money',

  'মেয়াদের':'expiry',
  'নবায়নের':'renewal',
  'চাওয়া':'requested',

  'সংখ্যার':'digits',

  'সেকেন্ড':'seconds',
  'পাতাটি':'page',
  'রিফ্রেশ':'refresh',

  'করেছে':'did',

  'কমিয়ে':'reduced',
  'লিস্টিংয়ে':'listing',

  'মাত্র':'only',

  'আসসালামু':'Assalamu',
  'আলাইকুম':'Alaikum',

  'খরচে':'cost',
  'মিনিটেই':'minutes',
  'মতো':'like',

  'ঢাকার':'Dhaka',
  'রাজশাহীর':'Rajshahi',
  'নাটোরের':'Natore',
  'নওগাঁর':'Naogaon',
  'বগুড়ার':'Bogura',
  'চাঁপাইনবাবগঞ্জের':'Chapainawabganj',

  'নিজেই':'yourself',
  'বাছুন':'Choose',

  'বাড়ান':'Increase',
  'কমান':'Decrease',

  'খোলা':'created',
  'পছন্দের':'preferred',

  'ব্যবসা':'Business',

  'দরদাম':'Negotiation',
  'নবায়ন':'Renewal',

  'ফসলের':'crop',
  'সবজির':'vegetable',
  'দৈনিক':'daily',

  'পাইলটে':'in pilot',
  'পরিদর্শনের':'inspection',

  'হিসেবে':'as',

  'থাকা':'stay',
  'মালই':'goods',

  'ক্ষতির':'loss',
  'হিসাবের':'accounts',
  'মানের':'quality',

  'পাকা':'ripe',
  'মাঝারি':'medium',
  'ক্রেটে':'crate',

  'একটু':'slightly',
  'দেরি':'late',
  'কাছাকাছি':'nearby',

  'হন':'be',
  'তিনি':'they',

  'বলতে':'to say',

  'আমরা':'We',

  'পাঠাব':'will send',
  'আনব':'will bring',

  'ব্যবস্থা':'arrangement',
  'বার্তা':'Message',

  'নেব':'will take',

  'লাগত':'would cost',

  'জানাবেন':'will notify',
  'দেখবেন':'will see',

  'মোবাইলে':'mobile',
  'দেখাবেন':'will show',

  'খেত':'field',
  'গুদামে':'warehouse',

  'সুবিধা':'benefit',

  'কতটা':'how much',

  'নরম':'soft',

  'মালে':'goods',

  'এসেছে':'arrived',
  'আজই':'today',

  'গ্রিড':'Grid',

  'ততদিন':'that long',
  'ধরা':'assumed',

  'শিগগির':'soon',
  'কিছুদিন':'a few days',
  'এসব':'these',

  'দিকনির্দেশ':'Direction',
  'সুযোগ':'Opportunity',

  'গৃহীত':'Accepted',
  'প্রত্যাখ্যাত':'Rejected',
  'অজানা':'Unknown',

  'দিলেও':'even if given',
  'ফিরে':'back',

  'সার্ভারে':'server',
  'পরই':'after',

  'কিন্তু':'but',
  'বাইরের':'outside',
  'ফিল্টারে':'filter',
  'মজুদের':'inventory',

  'হলো':'is',

  'যতক্ষণ':'while',
  'ততক্ষণ':'until then',

  'সেটা':'that',
  'তার':'their',

  'হিসাবে':'as',

  'অসম্পূর্ণ':'Incomplete',
  'ক্যালকুলেটর':'Calculator',

  'একটি':'a',

  'টাকায়':'BDT',

  'সার':'Fertilizer',
  'শ্রমিক':'Labor',

  'ফাঁকা':'blank',
  'বাদে':'excluding',
  'ছাড়া':'without',

  'সহজ':'Easy',
  'নেওয়া':'take',

  'সেখানকার':'there',
  'দূরের':'distant',

  'কথাও':'information',
  'ভাবুন':'consider',

  'রাখতে':'keep',

  'জরিমানা':'Penalty',

  'বেশির':'more',

  'বার':'times',
  'সদস্যের':'member',

  'পায়':'receives',
  'মণে':'maund',

  'প্রথম':'First',

  'ভুয়া':'fake',
  'ঠেকাতে':'prevent',

  'পৌঁছানো':'delivery',

  'জোড়া':'paired',
  'বারের':'times',

  'ব্যাংকে':'bank',

  'ওয়ালেটের':'wallet',
  'পয়েন্টের':'points',
  'যাচাইয়ের':'verification',

  'সবার':'everyone',

  'নিয়েছেন':'taken',

  'দামেই':'price',

  'দেওয়ার':'giving',

  'করব':'will do',
  'নইলে':'otherwise',

  'প্রস্তাবিত':'Suggested',

  'ডেলিভারি':'Delivery',

  'হাটে':'market',

  'পেলে':'if received',

  'সমস্যা':'Problem',

  'চাপবেন':'press',

  'ফোন':'Phone',
  'ইমো':'IMO',
  'হোয়াটসঅ্যাপে':'WhatsApp',

  'টায়':'at',
  'খেতে':'field',

  'জানান':'inform',
  'নই':'not',

  'অন্যের':'others',
  'দুজনেই':'both',

  'ছাউনিওয়ালা':'covered',
  'প্লাস্টিক':'Plastic',
  'ক্রেট':'crate',

  'লোডিংয়ে':'loading',
  'সাহায্য':'help',

  'আগেই':'already',
  'জানবেন':'will know',

  'সদস্যরা':'members',

  'ওজন':'Weight',
  'রুটের':'route',
  'অন্যদের':'others',

  'হলেও':'even if',
  'ফেরার':'return',
  'থাকায়':'because',

  'উপর':'above',

  'বিভাগ':'Section',

  'কোথা':'where',
  'গ্রাম':'village',

  'পৌঁছানোর':'delivery',

  'অফারেই':'offer',

  'বাছলে':'if selected',
  'পাশের':'nearby',

  'ফর্মে':'form',
  'বাছলেও':'even if selected',

  'যুক্ত':'included',
  'পৌঁছাবে':'will arrive',

  'শর্ত':'Condition',
  'ডেলিভারির':'delivery',

  'হালনাগাদ':'Update',

  'মাঝে':'between',

  'মূল':'Main',
  'প্রয়োজন':'needed',
  'প্রয়োজনীয়':'necessary',

  'মূল্যায়ন':'Evaluation',
  'কতটুকু':'how much',

  'ব্যবস্থার':'system',

  'রাস্তায়':'road',
  'চালানো':'operate',

  'যোগ্য':'eligible',
  'সীমা':'limit',
  'মেয়াদে':'term',

  'শুরুতে':'at start',

  'কথা':'note',

  'খরচের':'cost',

  'ঠিকমতো':'properly',

  'খুঁজে':'find',

  'ফলাফল':'Result',
  'ফল':'result',

  'ভবিষ্যৎ':'Future',

  'কালকের':'tomorrow',
  'পরশুর':'day after tomorrow'

};


/* =========================================================
   Main translation helper
   ========================================================= */

function translateBnText(input) {

  if (input == null) {
    return input;
  }

  let s = String(input);

  if (
    !/[\u0980-\u09ff]/.test(s)
  ) {
    return enDigits(s);
  }


  for (
    const [bn,en]
    of I18N_PHRASES
  ) {

    if (
      s.includes(bn)
    ) {
      s = s
        .split(bn)
        .join(en);
    }

  }


  s = enDigits(s);


  /*
   * Handle Bangla suffixes when they follow
   * already-translated English/dynamic content.
   */

  s = s
    .replace(
      /([A-Za-z0-9৳,.() ]+)-এর/g,
      "$1's"
    )
    .replace(
      /([A-Za-z0-9৳,.() ]+)-এ/g,
      '$1 in'
    )
    .replace(
      /([A-Za-z0-9৳,.() ]+)-কে/g,
      '$1'
    );


  /*
   * Dynamic units / dates / quantities.
   */

  s = s
    .replace(
      /(\d+(?:\.\d+)?)\s*দিন তাজা থাকবে/g,
      'Fresh for $1 days'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*মিনিট আগে/g,
      '$1 minutes ago'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*ঘণ্টা আগে/g,
      '$1 hours ago'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*দিন আগে/g,
      '$1 days ago'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*মাস আগে/g,
      '$1 months ago'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*মণ/g,
      '$1 maund'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*কেজি/g,
      '$1 kg'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*কিমি/g,
      '$1 km'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*ঘণ্টা/g,
      '$1 hours'
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*দিন/g,
      '$1 days'
    )
    .replace(
      /৳\s*(\d[\d,.]*)/g,
      '৳$1'
    );


  /*
   * Remaining domain words.
   */

  s = s.replace(
    /[\u0980-\u09ff]+/g,
    word =>
      Object.prototype
        .hasOwnProperty
        .call(
          I18N_WORDS,
          word
        )
        ? I18N_WORDS[word]
        : word
  );


  return s
    .replace(
      /।/g,
      '.'
    )
    .replace(
      /\s{2,}/g,
      ' '
    );

}


/* =========================================================
   Header language control
   ========================================================= */

function langBtn() {

  const en = isEn();

  return `
    <button
      class="btn btn-soft btn-sm"
      data-act="lang"
      type="button"
      aria-label="${
        en
          ? 'বাংলায় দেখুন'
          : 'Switch to English'
      }"
      title="${
        en
          ? 'বাংলায় দেখুন'
          : 'Switch to English'
      }"
    >
      <span aria-hidden="true">
        🌐
      </span>

      &nbsp;${
        en
          ? 'বাংলা'
          : 'EN'
      }
    </button>
  `;

}


/* =========================================================
   Document language / metadata
   ========================================================= */

function syncDocumentLanguage() {

  document.documentElement.lang =
    isEn()
      ? 'en'
      : 'bn';


  document.title =
    isEn()
      ? 'Reroute Agro | Wholesale Marketplace for Farmers & Wholesalers'
      : 'Reroute Agro | কৃষক ও পাইকারের পাইকারি বাজার';


  const meta =
    document.querySelector(
      'meta[name="description"]'
    );


  if (meta) {

    meta.setAttribute(
      'content',

      isEn()
        ? 'A direct wholesale marketplace for farmers and wholesalers: negotiation, secure payments, transport, inventory and profit/loss tracking.'
        : 'কৃষক ও পাইকারের সরাসরি পাইকারি বাজার: দরদাম, নিরাপদ পেমেন্ট, নিজস্ব ট্রাক, মজুদ ও লাভ-ক্ষতির হিসাব'
    );

  }

}


/* =========================================================
   DOM translation
   ========================================================= */

const I18N_TEXT_ORIG =
  new WeakMap();


const I18N_ATTR_ORIG =
  new WeakMap();


const I18N_ATTRS = [
  'aria-label',
  'title',
  'placeholder',
  'alt'
];


function translateTextNode(node) {

  if (
    !node ||
    node.nodeType !==
      Node.TEXT_NODE
  ) {
    return;
  }


  const parent =
    node.parentElement;


  if (
    !parent ||
    [
      'SCRIPT',
      'STYLE',
      'NOSCRIPT'
    ].includes(
      parent.tagName
    )
  ) {
    return;
  }


  if (
    !I18N_TEXT_ORIG
      .has(node)
  ) {

    I18N_TEXT_ORIG.set(
      node,
      node.nodeValue
    );

  }


  const original =
    I18N_TEXT_ORIG.get(
      node
    );


  const next =
    isEn()
      ? translateBnText(
          original
        )
      : original;


  if (
    node.nodeValue !== next
  ) {

    node.nodeValue =
      next;

  }

}


function translateElementAttrs(el) {

  if (
    !el ||
    el.nodeType !==
      Node.ELEMENT_NODE
  ) {
    return;
  }


  let saved =
    I18N_ATTR_ORIG.get(
      el
    );


  if (!saved) {

    saved = {};

    I18N_ATTR_ORIG.set(
      el,
      saved
    );

  }


  for (
    const attr
    of I18N_ATTRS
  ) {

    if (
      !el.hasAttribute(attr)
    ) {
      continue;
    }


    if (
      !(attr in saved)
    ) {

      saved[attr] =
        el.getAttribute(
          attr
        );

    }


    const next =
      isEn()
        ? translateBnText(
            saved[attr]
          )
        : saved[attr];


    if (
      el.getAttribute(attr)
      !== next
    ) {

      el.setAttribute(
        attr,
        next
      );

    }

  }

}


/* =========================================================
   Apply selected language
   ========================================================= */

function applyLanguage(
  root = document
) {

  syncDocumentLanguage();


  if (!root) {
    return;
  }


  if (
    root.nodeType ===
      Node.TEXT_NODE
  ) {

    translateTextNode(
      root
    );

    return;

  }


  if (
    root.nodeType ===
      Node.ELEMENT_NODE
  ) {

    translateElementAttrs(
      root
    );

  }


  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT |
      NodeFilter.SHOW_TEXT
    );


  let node;


  while (
    (
      node =
        walker.nextNode()
    )
  ) {

    if (
      node.nodeType ===
        Node.TEXT_NODE
    ) {

      translateTextNode(
        node
      );

    }
    else {

      translateElementAttrs(
        node
      );

    }

  }

}


/* =========================================================
   Set + persist language
   ========================================================= */

function setLanguage(lang) {

  APP_LANG =
    lang === 'en'
      ? 'en'
      : 'bn';


  try {

    localStorage.setItem(
      LANG_KEY,
      APP_LANG
    );

  }
  catch (e) {}


  syncDocumentLanguage();

}


/* =========================================================
   Observe dynamic content
   ========================================================= */

let I18N_OBSERVER = null;


function startI18nObserver() {

  if (
    I18N_OBSERVER ||
    !document.body
  ) {
    return;
  }


  I18N_OBSERVER =
    new MutationObserver(
      list => {

        /*
         * Bangla is already the source language,
         * so dynamic translation is only needed
         * while English mode is active.
         */

        if (!isEn()) {
          return;
        }


        for (
          const mutation
          of list
        ) {

          if (
            mutation.type ===
            'characterData'
          ) {

            translateTextNode(
              mutation.target
            );

          }


          for (
            const node
            of mutation.addedNodes
          ) {

            applyLanguage(
              node
            );

          }

        }

      }
    );


  I18N_OBSERVER.observe(
    document.body,
    {
      subtree: true,
      childList: true,
      characterData: true
    }
  );


  applyLanguage(
    document.body
  );

}


/* Initial preference */
syncDocumentLanguage();
startI18nObserver();
