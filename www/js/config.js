angular.module('starter')
//config param of App
.constant('appConfig', {

<<<<<<< HEAD
    DOMAIN_URL: 'https://anaket.delivery/',
=======
    DOMAIN_URL: 'http://anaket.delivery',
>>>>>>> 33dbfd733441f4df9c3dfd815244f000c976bf28
	ADMIN_EMAIL: 'lb.market.sys@gmail.com',
        
	CLIENT_ID_AUTH0: 'H62fCSFGxrbKTRwArIJRdRjuhFnscgN',
	DOMAIN_AUTH0: 'khanhtt.auth0.com',
        
	ENABLE_FIRST_LOGIN: false,
	
	ENABLE_THEME: 'topgears',
	
	ENABLE_PUSH_PLUGIN: false,
	ENABLE_PAYPAL_PLUGIN: false,
	ENABLE_STRIPE_PLUGIN: false,
	ENABLE_RAZORPAY_PLUGIN: false,
	ENABLE_MOLLIE_PLUGIN: false,
	ENABLE_OMISE_PLUGIN: false
	}
)


//dont change this value if you dont know what it is
.constant('appValue', {
//	API_URL: '/module/icymobi/', //for prestashop platform
 	API_URL: '/is-commerce/api/', //for worpdress and magento platform
//  API_URL: '/index.php?route=icymobi/front/', //for opencart platform
	API_SUCCESS: 1,
	API_FAILD: -1
})


//list language
.constant('listLanguage', [
           
            {code: 'es', text: 'Castellano'},
			 //{code: 'en', text: 'English'},
			//{code: 'fr', text: 'French'},
	]
)
;
(function () {
	new WOW().init();
});
