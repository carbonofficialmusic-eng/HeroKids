import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  BackHandler,
  Platform,
  Linking,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONFIG } from '@/constants/config';

export default function HomeScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backAction = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => backHandler.remove();
    }
  }, [canGoBack]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  const handleShouldStartLoadWithRequest = useCallback((request: any) => {
    const { url } = request;
    
    if (url.startsWith(APP_CONFIG.WEB_APP_URL)) {
      return true;
    }
    
    if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      Linking.openURL(url);
      return false;
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      Linking.openURL(url);
      return false;
    }
    
    return true;
  }, []);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  const injectedJavaScript = `
    (function() {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      document.head.appendChild(meta);
      
      document.body.style.overscrollBehavior = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.userSelect = 'none';
      
      true;
    })();
  `;

  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>Keine Verbindung</Text>
          <Text style={styles.errorMessage}>
            HeroKids konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.
          </Text>
          <Text style={styles.retryButton} onPress={handleRetry}>
            Erneut versuchen
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: APP_CONFIG.WEB_APP_URL }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={true}
        pullToRefreshEnabled={true}
        injectedJavaScript={injectedJavaScript}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        contentMode="mobile"
      />
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={APP_CONFIG.PRIMARY_COLOR} />
          <Text style={styles.loadingText}>HeroKids lädt...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.BACKGROUND_COLOR,
  },
  webView: {
    flex: 1,
    backgroundColor: APP_CONFIG.BACKGROUND_COLOR,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: APP_CONFIG.BACKGROUND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: APP_CONFIG.BACKGROUND_COLOR,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: APP_CONFIG.PRIMARY_COLOR,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
