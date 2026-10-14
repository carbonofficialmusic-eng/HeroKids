#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppReviewPlugin, "AppReviewPlugin",
    CAP_PLUGIN_METHOD(requestReview, CAPPluginReturnPromise);
)
