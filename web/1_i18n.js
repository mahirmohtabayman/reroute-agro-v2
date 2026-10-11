/* =====================================================================
   Reroute Agro — Bangla / English language layer
   ===================================================================== */
const LANG_KEY = 'reroute-lang';
let APP_LANG = 'bn';
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === 'bn' || saved === 'en') APP_LANG = saved;
} catch (e) {}

function curLang(){ return APP_LANG; }
function isEn(){ return APP_LANG === 'en'; }
function langLocale(){ return isEn() ? 'en-US' : 'bn-BD'; }

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function enDigits(v){ return String(v).replace(/[০-৯]/g,d=>String(BN_DIGITS.indexOf(d))); }

/* Long phrases first. These keep the English UI natural instead of word-by-word. */
const I18N_PHRASES = [
  ['কৃষকের মাল, পাইকারের বাজার','Produce from farmers, market for wholesalers'],
  ['সরাসরি কেনাবেচা ও দরদাম, নিরাপদ পেমেন্ট, আর নিজস্ব ট্রাকে কম খরচে পরিবহন।','Trade and negotiate directly, pay securely, and move goods at lower cost with Reroute transport.'],
  ['মাঝখানে দালাল নেই, কৃষক আর পাইকার নিজেরাই দাম ঠিক করেন।','No middleman — farmers and wholesalers negotiate prices directly.'],
  ['মাল বুঝে পাওয়া পর্যন্ত টাকা Reroute-এ জমা থাকে, তারপর বিক্রেতা পান।','Money stays secured with Reroute until the goods are received, then the seller is paid.'],
  ['শেয়ার্ড ট্রাকে মাল যায়, তাই বাজারের চেয়ে কম ভাড়ায় পৌঁছায়।','Shared transport helps deliver goods at a lower cost than hiring a truck independently.'],
  ['কৃষক ও পাইকারের সরাসরি পাইকারি বাজার: দরদাম, নিরাপদ পেমেন্ট, নিজস্ব ট্রাক, মজুদ ও লাভ-ক্ষতির হিসাব','A direct wholesale marketplace for farmers and wholesalers: negotiation, secure payments, transport, inventory and profit/loss tracking'],
  ['কৃষক ও পাইকারের পাইকারি বাজার','Wholesale marketplace for farmers and wholesalers'],
  ['ডেমো নতুন করে শুরু করবেন?','Restart the demo?'],
  ['সব ডেমো ডেটা শুরুর অবস্থায় ফিরবে।','All demo data will return to its initial state.'],
  ['ডেমো নতুন করে শুরু হয়েছে','The demo has been restarted'],
  ['সার্ভারের সাথে যোগাযোগ হচ্ছে না, একটু পরে চেষ্টা করুন','Cannot connect to the server. Please try again shortly.'],
  ['তথ্য ঠিকভাবে দিন','Please enter the information correctly'],
  ['কাজটি হয়নি, আবার চেষ্টা করুন','The action could not be completed. Please try again.'],
  ['এই পাতাটা পাওয়া গেল না','Page not found'],
  ['লিংকটা হয়তো ভুল, বা পাতাটা সরানো হয়েছে।','The link may be incorrect or the page may have been moved.'],
  ['শুরুতে ফিরুন','Back to home'],
  ['আপনি কে, বাছুন','Choose your account type'],
  ['ডেমো অ্যাকাউন্ট, এক চাপে ঢুকুন','Demo accounts — enter with one click'],
  ['লগ ইন ছাড়াই বাজার দেখুন','Browse the market without logging in'],
  ['নতুন? অ্যাকাউন্ট খুলুন','New here? Create an account'],
  ['নাম আর ০১ দিয়ে শুরু ১১ সংখ্যার নম্বর দিন','Enter a name and an 11-digit mobile number starting with 01'],
  ['অ্যাকাউন্ট খোলা হয়েছে','Account created successfully'],
  ['এই খোঁজে কোনো মাল পাওয়া গেল না','No produce matched your search'],
  ['অন্য ফসল, জেলা বা দাম দিয়ে আবার দেখুন।','Try another crop, district or price range.'],
  ['সব ফিল্টার মুছুন','Clear all filters'],
  ['এই লিস্টিংটা আর নেই','This listing is no longer available'],
  ['হয়তো সব বিক্রি হয়ে গেছে, বা বিক্রেতা বন্ধ করে দিয়েছেন।','It may be sold out or the seller may have closed it.'],
  ['বাজারে ফিরুন','Back to market'],
  ['ছবি দেওয়া হয়নি','No photo provided'],
  ['বিক্রেতা ছবি দেননি','The seller did not provide a photo'],
  ['অফার দিতে লগ ইন করুন','Log in to make an offer'],
  ['এই মাল এখন বিক্রি হচ্ছে না।','This produce is not currently for sale.'],
  ['আগে মাল দেখতে চাই (ভিডিও / সরাসরি)','Inspect before buying (video / in person)'],
  ['অফার দিলে বিক্রেতা রাজি না হওয়া পর্যন্ত কিছু নিশ্চিত হয় না, টাকাও কাটে না।','Nothing is confirmed and no money is charged until the seller accepts your offer.'],
  ['ফোন নম্বর ও লেনদেনের বিস্তারিত গোপন। অর্ডারের পেমেন্ট হলে দুজনে নম্বর পান।','Phone numbers and transaction details stay private. Both parties receive contact details after order payment.'],
  ['এখন কোনো লিস্টিং নেই','No active listings right now'],
  ['এখনো রিভিউ নেই','No reviews yet'],
  ['কোনো অফার নেই','No offers yet'],
  ['কোনো পরিদর্শন নেই','No inspections'],
  ['মাল বুঝে পেয়েছি','I received the goods'],
  ['পাইকারকে মাল বুঝিয়ে দিয়েছি','I handed the goods to the wholesaler'],
  ['ট্রাকে মাল তুলে দিয়েছি','I loaded the goods onto the truck'],
  ['মাল পৌঁছালে ক্রেতা নিশ্চিত করবেন, তখন টাকা আপনার ওয়ালেটে যাবে।','The buyer will confirm after delivery, then the money will move to your wallet.'],
  ['আপনার টাকা Reroute-এ জমা আছে।','Your money is secured with Reroute.'],
  ['মালের খরচ দেওয়া নেই, তাই সঠিক লাভ বলা যাচ্ছে না।','Produce cost is missing, so exact profit cannot be calculated.'],
  ['বুকিং পাওয়া যায়নি','Booking not found'],
  ['অফার পাওয়া যায়নি','Offer not found'],
  ['অর্ডার পাওয়া যায়নি','Order not found'],
  ['পাওয়া যায়নি','Not found'],
  ['বুকিং অনুরোধ','Booking requested'],
  ['বুকিং নিশ্চিত','Booking confirmed'],
  ['মাল তোলার সময় ঠিক','Pickup scheduled'],
  ['মাল তোলার সময়','Pickup time'],
  ['মাল ট্রাকে উঠেছে, পথে আছে।','Goods have been loaded and are in transit.'],
  ['মাল গন্তব্যে পৌঁছে গেছে।','Goods have reached the destination.'],
  ['ক্রেতার পেমেন্টের অপেক্ষা।','Waiting for buyer payment.'],
  ['পেমেন্ট হলে অর্ডার নিশ্চিত হবে','The order will be confirmed after payment'],
  ['রাজি হলে পেমেন্ট করুন','If you accept, proceed to payment'],
  ['অফার তুলে নিন','Withdraw offer'],
  ['দরদামের ইতিহাস','Negotiation history'],
  ['পেমেন্ট বাকি','Payment pending'],
  ['অর্ডার নিশ্চিত','Order confirmed'],
  ['মাল হস্তান্তর হয়েছে','Goods handed over'],
  ['বিক্রেতা রাজি','Seller accepted'],
  ['পেমেন্ট ও অর্ডার নিশ্চিত','Payment & order confirmed'],
  ['মাল হস্তান্তর','Handover'],
  ['অর্ডার বাতিল হয়েছে','Order cancelled'],
  ['সময়মতো পেমেন্ট হয়নি','Payment was not made in time'],
  ['লিস্টিং প্রকাশ করবেন?','Publish this listing?'],
  ['প্রকাশ হলে সব কৃষক ও পাইকার দেখতে পাবেন।','Once published, all farmers and wholesalers can see it.'],
  ['লিস্টিং প্রকাশ হয়েছে','Listing published'],
  ['জরুরি বিক্রি চালু করবেন?','Enable urgent sale?'],
  ['জরুরি বিক্রি চালু, পাইকারদের জানানো হয়েছে','Urgent sale enabled and wholesalers have been notified'],
  ['চলমান অফার আর অর্ডারের দাম বদলাবে না।','Existing offers and orders will keep their current prices.'],
  ['দাম বদলানো হয়েছে','Price updated'],
  ['পরিমাণ বাড়ান বা কমান','Increase or decrease quantity'],
  ['পরিমাণ বদলানো হয়েছে','Quantity updated'],
  ['বন্ধ থাকলে কেউ নতুন অফার দিতে পারবেন না। পরে আবার চালু করা যাবে।','No new offers can be made while paused. You can activate it again later.'],
  ['সবাই আবার দেখতে ও অফার দিতে পারবেন।','Everyone can view it and make offers again.'],
  ['অফার পাঠাবেন?','Send this offer?'],
  ['বিক্রেতা রাজি হলে পেমেন্ট করতে বলা হবে। এখন কোনো টাকা কাটবে না।','You will be asked to pay only after the seller accepts. No money is charged now.'],
  ['অফার পাঠানো হয়েছে','Offer sent'],
  ['পাল্টা দাম পাঠাবেন?','Send a counteroffer?'],
  ['পাল্টা দাম পাঠানো হয়েছে','Counteroffer sent'],
  ['মাল হাতে পেয়েছেন?','Have you received the goods?'],
  ['নিশ্চিত করলে বিক্রেতা টাকা পাবেন, আর এটা ফেরানো যাবে না।','After confirmation, the seller will be paid and this action cannot be reversed.'],
  ['অর্ডার সম্পূর্ণ হয়েছে','Order completed'],
  ['পেমেন্ট সফল','Payment successful'],
  ['পেমেন্ট হয়নি','Payment failed'],
  ['আবার চেষ্টা','Try again'],
  ['পরে করব','Do it later'],
  ['পেমেন্ট করুন','Pay now'],
  ['ব্যালান্স যথেষ্ট নয়','Insufficient balance'],
  ['কার্ড নম্বর (১৬ সংখ্যা)','Card number (16 digits)'],
  ['ডেবিট/ক্রেডিট কার্ড','Debit/Credit Card'],
  ['মোবাইল নম্বর ও পিন','Mobile number and PIN'],
  ['কার্ড পেমেন্ট','Card payment'],
  ['মোট ট্রাক ভাড়া','Total transport cost'],
  ['Reroute সেবা চার্জ','Reroute service fee'],
  ['আপনার কাছে আনার খরচ (আনুমানিক)','Estimated delivery cost to you'],
  ['বিক্রির জন্য আছে','Available for sale'],
  ['অর্ডারে আটকে আছে','Reserved in orders'],
  ['এ পর্যন্ত বিক্রি','Sold so far'],
  ['সর্বনিম্ন অর্ডার','Minimum order'],
  ['আজকের বাজার দর আনুমানিক','Estimated market price today'],
  ['জরুরি বিক্রি','Urgent sale'],
  ['লিস্টিং পরিচালনা','Manage listing'],
  ['সম্পূর্ণ লেনদেন','Completed transactions'],
  ['মোট পরিমাণ','Total quantity'],
  ['চালু লিস্টিং','Active listings'],
  ['AI পরামর্শ','AI Advice'],
  ['কোথায় বেচবেন','Where to sell'],
  ['কোথায় কিনবেন','Where to buy'],
  ['বাজারের অবস্থা','Market overview'],
  ['মূল পরামর্শ','Key Recommendation'],
  ['AI হিসাব করছে...','AI is calculating...'],
  ['সবচেয়ে লাভ','Best return'],
  ['লাভ বেশি','Higher return'],
  ['স্থানীয় হাট','Local market'],
  ['কম পাবেন','Lower return'],
  ['উৎপাদন খরচ বাদে আনুমানিক লাভ','Estimated profit after production cost'],
  ['হাতে থাকবে আনুমানিক','Estimated net amount'],
  ['এই ফসলের লিস্টিং নেই।','There are no listings for this crop.'],
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
  ['উৎপাদন খরচ ৳/কেজি (ঐচ্ছিক)','Production cost ৳/kg (optional)'],
  ['প্রত্যাশিত দাম','Expected price'],
  ['হাতে থাকবে','Estimated net'],
  ['কোন বাজারে কত থাকবে','Market comparison'],
  ['দাম/কেজি','Price/kg'],
  ['স্থানীয়ের চেয়ে','vs local'],
  ['কোন দিন পাঠালে কত থাকবে','Net amount by send day'],
  ['কেনার দাম','Purchase price'],
  ['পৌঁছে খরচ','Landed cost'],
  ['লাভ/কেজি','Profit/kg'],
  ['মোট লাভ','Total profit'],
  ['এখন উৎস পাওয়া যায়নি','No suitable sources found right now'],
  ['কাল পাঠান','Send tomorrow'],
  ['পরশু পাঠান','Send the day after tomorrow'],
  ['উত্তরের অপেক্ষা','Awaiting response'],
  ['পাল্টা দাম এসেছে','Counteroffer received'],
  ['রাজি হননি','Declined'],
  ['ছবি ও মানের তথ্য','Photo and quality information'],
  ['বিক্রির টাকা','Sale proceeds'],
  ['খরচ বাদে হাতে এসেছে','Net after costs'],
  ['ঠিক আছে','OK'],
  ['নিশ্চিত করুন','Confirm'],
  ['একটি কারণ দিন','Provide a reason'],
  ['ছোট মন্তব্য (ঐচ্ছিক)','Short comment (optional)'],
  ['রেটিং দিন','Submit rating'],
  ['বের হন','Log out'],
  ['লগ ইন','Log in'],
  ['সংরক্ষণ হয়েছে','Saved successfully'],
  ['প্রোফাইল সংরক্ষণ হয়েছে','Profile saved'],
  ['হালনাগাদ হয়েছে','Updated successfully'],
  ['অনুরোধ পাঠানো হয়েছে','Request sent'],
  ['Reroute Agro · Social Catalyst | ডেমো সংস্করণ','Reroute Agro · Social Catalyst | Demo version'],
  ['AI দামের মডেল','AI Price Model'],
  ['দামের চার্ট','Price chart'],
  ['প্রশিক্ষণ','Training'],
  ['অদেখা সময়ে পরীক্ষা','Out-of-sample test'],
  ['গড় ভুল','Average error'],
  ['দাম বাড়বে না কমবে','Price direction'],
  ['কালো: আসল দাম · সবুজ ডটেড: মডেলের পূর্বাভাস (যাচাই) · লাল: পরের মাস','Black: actual price · green dotted: model forecast (validation) · red: next month'],
  ['সার্ভার চালু হচ্ছে, কয়েক সেকেন্ড পরে পাতাটি রিফ্রেশ করুন।','The server is starting. Refresh the page after a few seconds.']
].sort((a,b)=>b[0].length-a[0].length);

const I18N_WORDS = {
  'ড্যাশবোর্ড':'Dashboard','হোম':'Home','বাজার':'Market','বাজারে':'market','বাজারের':'market','বাজারদর':'market price',
  'লিস্টিং':'Listing','লেনদেন':'Transactions','পরিবহন':'Transport','অ্যাকাউন্ট':'Account','প্রোফাইল':'Profile',
  'কৃষক':'Farmer','পাইকার':'Wholesaler','বিক্রেতা':'Seller','ক্রেতা':'Buyer','ব্যবহারকারী':'Users','অপারেশন':'Operations','টিম':'Team',
  'অফার':'Offer','অর্ডার':'Order','বুকিং':'Booking','ট্রাক':'Truck','মাল':'goods','ফসল':'Crop','দাম':'Price','দর':'Price','পরিমাণ':'Quantity',
  'খরচ':'Cost','লাভ':'Profit','লোকসান':'Loss','ক্ষতি':'Loss','মজুদ':'Inventory','হিসাব':'Accounts','ওয়ালেট':'Wallet','পয়েন্ট':'Points',
  'প্লাস':'Plus','প্ল্যাটফর্ম':'Platform','ফি':'Fee','সেবা':'Service','চার্জ':'Charge','চালু':'Active','বন্ধ':'Paused','বাতিল':'Cancelled',
  'সম্পূর্ণ':'Completed','সফল':'Successful','ব্যর্থ':'Failed','অপেক্ষমাণ':'Pending','নিশ্চিত':'Confirmed','অনুরোধ':'Request','পরিদর্শন':'Inspection',
  'জরুরি':'Urgent','স্থানীয়':'Local','শেয়ার্ড':'Shared','নিজে':'Self','নিজের':'own','নিজস্ব':'own','নতুন':'New','পুরো':'Full','অর্ধেক':'Half',
  'আজ':'Today','কাল':'Tomorrow','পরশু':'Day after tomorrow','আগামীকাল':'Tomorrow','গতকাল':'Yesterday','এখন':'Now','এখনো':'Still','আগে':'ago','পরে':'later',
  'দিন':'days','মাস':'months','ঘণ্টা':'hours','মিনিট':'minutes','সময়':'Time','মেয়াদ':'Expiry','শুরু':'Start','শেষ':'End',
  'কেজি':'kg','মণ':'maund','কিমি':'km','টাকা':'BDT','মোট':'Total','প্রতি':'per','সর্বনিম্ন':'Minimum','সর্বোচ্চ':'Maximum','আনুমানিক':'Estimated','প্রায়':'about',
  'বিক্রি':'Sell','কেনা':'Buy','কিনুন':'Buy','কিনবেন':'buy','কিনতে':'buy','বেচবেন':'sell','পাঠান':'Send','পাঠালে':'if sent','পাঠাবেন':'send',
  'তোলা':'pickup','তোলার':'pickup','পৌঁছেছে':'Delivered','পৌঁছে':'delivered','পথে':'In transit','হস্তান্তর':'Handover','ফেরত':'Refund','জমা':'secured',
  'পেমেন্ট':'Payment','নগদ':'Nagad','বিকাশ':'bKash','কার্ড':'Card','ব্যালান্স':'Balance','পিন':'PIN','নম্বর':'Number','মোবাইল':'Mobile','নাম':'Name',
  'জেলা':'District','এলাকা':'Area','উপজেলা':'Upazila','ছবি':'Photo','মান':'Quality','গ্রেড':'Grade','রিভিউ':'Reviews','রেটিং':'Rating','যাচাই':'Verify','যাচাইকৃত':'Verified',
  'জাতীয়':'National','পরিচয়পত্র':'ID','লাইসেন্স':'License','চালক':'Driver','গাড়ি':'Vehicle','সব':'All','সবাই':'Everyone','কোনো':'Any','কিছু':'Some','আরও':'More','অন্য':'Other','শুধু':'Only',
  'এই':'This','এখানে':'Here','থেকে':'from','পর্যন্ত':'until','দেখুন':'View','ফিরুন':'Back','ঢুকুন':'Enter','বের':'Logout','সংরক্ষণ':'Save','প্রকাশ':'Publish',
  'বদলান':'Change','যোগ':'Add','সরান':'Remove','মুছুন':'Clear','খুঁজুন':'Search','ফিল্টার':'Filter','সাজান':'Sort','তথ্য':'Information','বিবরণ':'Description','কারণ':'Reason','অবস্থা':'Status','ধরন':'Type',
  'ডেটা':'Data','মডেল':'Model','পরামর্শ':'Advice','অনুমান':'estimate','আসল':'real','ডেমো':'Demo','আমার':'My','আপনার':'Your','আপনি':'You','আমি':'I','আমাদের':'Our',
  'আর':'and','ও':'and','এবং':'and','বা':'or','জন্য':'for','সাথে':'with','মধ্যে':'between','অনুযায়ী':'according to','বেশি':'more','কম':'less','ভালো':'good','সেরা':'Best',
  'ঠিক':'correct','ভুল':'incorrect','তাজা':'fresh','নষ্ট':'spoil','দ্রুত':'quickly','আছে':'available','নেই':'none','হবে':'will be','হয়েছে':'has been','হয়নি':'not completed','হচ্ছে':'is happening',
  'থাকবে':'will remain','পাবেন':'will receive','যাবে':'will go','গেছে':'has gone','হয়':'is','নয়':'not','ছিল':'was','করুন':'Please','করবেন':'will you','করলে':'if you do','করতে':'to do','করা':'done','করে':'by','করেছেন':'did',
  'দিতে':'to give','দেওয়া':'provided','দিয়েছেন':'provided','দিলে':'if given','দেবেন':'will give','নিন':'take','রাখুন':'keep','পান':'receive','চান':'want','পারবেন':'can','রাজি':'Accept','পাল্টা':'Counter','উত্তর':'Response','অপেক্ষা':'Waiting',
  'উৎপাদন':'Production','হাতে':'net','তুলনা':'Comparison','পূর্বাভাস':'Forecast','চাহিদা':'Demand','উৎস':'Source','লাইট':'Light','ডার্ক':'Dark','মোড':'mode','মেনু':'Menu','নোটিফিকেশন':'Notifications','লোড':'Loading','সার্ভার':'Server','ভিডিও':'Video','সরাসরি':'Direct',
  'টমেটো':'Tomato','বেগুন':'Eggplant','কাঁচা':'Green','মরিচ':'chili','শসা':'Cucumber','গাজর':'Carrot','পেঁয়াজ':'Onion','আলু':'Potato','চাল':'Rice','মসুর':'Lentil','ডাল':'lentils','ভোজ্য':'Edible','তেল':'oil','আটা':'Flour',
  'রাজশাহী':'Rajshahi','নাটোর':'Natore','নওগাঁ':'Naogaon','চাঁপাইনবাবগঞ্জ':'Chapainawabganj','বগুড়া':'Bogura','ঢাকা':'Dhaka',
  'জানু':'Jan','ফেব্রু':'Feb','মার্চ':'Mar','এপ্রি':'Apr','মে':'May','জুন':'Jun','জুলা':'Jul','আগ':'Aug','সেপ্টে':'Sep','অক্টো':'Oct','নভে':'Nov','ডিসে':'Dec',
  'কোথায়':'Where','কীভাবে':'How','কী':'What','কোন':'Which','কত':'How much','কখন':'When','কেন':'Why','হ্যাঁ':'Yes','না':'No','তাই':'therefore','যদি':'if','তবে':'then','ঐচ্ছিক':'optional',
  'গোপন':'private','নিরাপদ':'secure','পাইকারি':'wholesale','দালাল':'middleman','বাড়তে':'increase','কমতে':'decrease','সঠিক':'accurate','সাধারণ':'general','প্রশিক্ষণ':'Training','পরীক্ষা':'Test','ফলাফল':'Result',
  'সারাংশ':'Summary','বহর':'Fleet','ব্যবসা':'Business','ব্যবসার':'Business','আড়ত':'Trading house','যোগাযোগ':'Contact','নিরাপত্তা':'Security','গোপনীয়তা':'Privacy','স্বাগতম':'Welcome','বিস্তারিত':'Details','মূল':'Main','প্রয়োজন':'needed','প্রয়োজনীয়':'necessary',
  'ক্যাশব্যাক':'Cashback','অগ্রাধিকার':'Priority','ডেলিভারি':'Delivery','সাবস্ক্রিপশন':'Subscription','কোম্পানি':'Company','ঘাঁটি':'Base','ট্রিপ':'Trip','রুটের':'route','দূরত্ব':'Distance','তারিখ':'Date','খালি':'Available','মেরামতে':'Maintenance'
};

/* Bengali romanization fallback for names/user text/unmapped words. */
const BN_ROMAN = {
  'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou',
  'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'n','ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n','প':'p','ফ':'f','ব':'b','ভ':'bh','ম':'m','য':'y','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h','ড়':'r','ঢ়':'rh','য়':'y','ৎ':'t','ং':'ng','ঃ':'h','ঁ':'n',
  'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou','্':'','়':''
};
function romanizeBn(s){
  return String(s).split('').map(ch=>BN_ROMAN[ch] ?? ch).join('').replace(/\s+/g,' ').trim();
}

function translateBnText(input){
  if (input == null) return input;
  let s = String(input);
  if (!/[\u0980-\u09ff]/.test(s)) return enDigits(s);

  for (const [bn,en] of I18N_PHRASES) {
    if (s.includes(bn)) s = s.split(bn).join(en);
  }
  s = enDigits(s);

  s = s
    .replace(/(\d+(?:\.\d+)?)\s*মণ/g,'$1 maund')
    .replace(/(\d+(?:\.\d+)?)\s*কেজি/g,'$1 kg')
    .replace(/(\d+(?:\.\d+)?)\s*কিমি/g,'$1 km')
    .replace(/(\d+(?:\.\d+)?)\s*ঘণ্টা/g,'$1 hours')
    .replace(/(\d+(?:\.\d+)?)\s*মিনিট/g,'$1 minutes')
    .replace(/(\d+(?:\.\d+)?)\s*দিন/g,'$1 days')
    .replace(/৳\s*(\d[\d,.]*)/g,'৳$1');

  s = s.replace(/[\u0980-\u09ff]+/g,word=>{
    if (Object.prototype.hasOwnProperty.call(I18N_WORDS,word)) return I18N_WORDS[word];
    return romanizeBn(word);
  });

  return s.replace(/।/g,'.').replace(/\s{2,}/g,' ').trim();
}

function langBtn(){
  const en = isEn();
  return `<button class="btn btn-soft btn-sm langbtn" data-act="lang" type="button" data-i18n-skip aria-label="${en?'বাংলা ভাষায় দেখুন':'Switch to English'}" title="${en?'বাংলা ভাষায় দেখুন':'Switch to English'}"><span aria-hidden="true">🌐</span><span>${en?'বাংলা':'EN'}</span></button>`;
}

function syncDocumentLanguage(){
  document.documentElement.lang = isEn() ? 'en' : 'bn';
  document.title = isEn()
    ? 'Reroute Agro | Wholesale Marketplace for Farmers & Wholesalers'
    : 'Reroute Agro | কৃষক ও পাইকারের পাইকারি বাজার';
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', isEn()
    ? 'A direct wholesale marketplace for farmers and wholesalers: negotiation, secure payments, transport, inventory and profit/loss tracking.'
    : 'কৃষক ও পাইকারের সরাসরি পাইকারি বাজার: দরদাম, নিরাপদ পেমেন্ট, নিজস্ব ট্রাক, মজুদ ও লাভ-ক্ষতির হিসাব');
}

const I18N_TEXT_ORIG = new WeakMap();
const I18N_ATTR_ORIG = new WeakMap();
const I18N_ATTRS = ['aria-label','title','placeholder','alt'];

function i18nSkip(node){
  const el = node && (node.nodeType===Node.ELEMENT_NODE ? node : node.parentElement);
  return !!(el && el.closest && el.closest('[data-i18n-skip]'));
}

function translateTextNode(node){
  if (!node || node.nodeType!==Node.TEXT_NODE || i18nSkip(node)) return;
  const p=node.parentElement;
  if (!p || ['SCRIPT','STYLE','NOSCRIPT','CODE','PRE'].includes(p.tagName)) return;
  if (!I18N_TEXT_ORIG.has(node)) I18N_TEXT_ORIG.set(node,node.nodeValue);
  const original=I18N_TEXT_ORIG.get(node);
  const next=isEn()?translateBnText(original):original;
  if (node.nodeValue!==next) node.nodeValue=next;
}

function translateElementAttrs(el){
  if (!el || el.nodeType!==Node.ELEMENT_NODE || i18nSkip(el)) return;
  let saved=I18N_ATTR_ORIG.get(el);
  if(!saved){ saved={}; I18N_ATTR_ORIG.set(el,saved); }
  for(const attr of I18N_ATTRS){
    if(!el.hasAttribute(attr)) continue;
    if(!(attr in saved)) saved[attr]=el.getAttribute(attr);
    const next=isEn()?translateBnText(saved[attr]):saved[attr];
    if(el.getAttribute(attr)!==next) el.setAttribute(attr,next);
  }
}

function applyLanguage(root=document){
  syncDocumentLanguage();
  if(!root) return;
  if(root.nodeType===Node.TEXT_NODE){ translateTextNode(root); return; }
  if(root.nodeType===Node.ELEMENT_NODE) translateElementAttrs(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    if(node.nodeType===Node.TEXT_NODE) translateTextNode(node);
    else translateElementAttrs(node);
  }
}

function setLanguage(lang){
  APP_LANG = lang==='en'?'en':'bn';
  try{ localStorage.setItem(LANG_KEY,APP_LANG); }catch(e){}
  syncDocumentLanguage();
  applyLanguage(document.body);
}

let I18N_OBSERVER=null;
function startI18nObserver(){
  if(I18N_OBSERVER || !document.body) return;
  I18N_OBSERVER=new MutationObserver(list=>{
    if(!isEn()) return;
    for(const mutation of list){
      if(mutation.type==='characterData') translateTextNode(mutation.target);
      for(const node of mutation.addedNodes) applyLanguage(node);
    }
  });
  I18N_OBSERVER.observe(document.body,{subtree:true,childList:true,characterData:true});
  applyLanguage(document.body);
}

syncDocumentLanguage();
startI18nObserver();
