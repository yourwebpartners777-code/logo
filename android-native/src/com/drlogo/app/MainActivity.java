package com.drlogo.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final int REQUEST_AUDIO_PERMISSION = 20;

    private WebView webView;
    private ProgressBar progressBar;
    private PermissionRequest pendingPermissionRequest;
    private String projectServerUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        projectServerUrl = normalizeUrl(getString(R.string.project_server_url));
        showWebApp(projectServerUrl);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_AUDIO_PERMISSION && pendingPermissionRequest != null) {
            if (hasAudioPermission()) {
                pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
        }
    }

    private void requestRuntimePermissions() {
        if (Build.VERSION.SDK_INT < 23) {
            return;
        }
        ArrayList<String> permissions = new ArrayList<>();
        if (!hasAudioPermission()) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!permissions.isEmpty()) {
            requestPermissions(permissions.toArray(new String[0]), REQUEST_AUDIO_PERMISSION);
        }
    }

    private boolean hasAudioPermission() {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void showWebApp(String url) {
        FrameLayout root = new FrameLayout(this);
        setContentView(root);

        try {
            webView = new WebView(this);
            progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            progressBar.setMax(100);

            root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3));
            progressParams.gravity = Gravity.TOP;
            root.addView(progressBar, progressParams);

            configureWebView(url);
            webView.loadUrl(url);
        } catch (Throwable throwable) {
            showStartupError(root, throwable);
        }
    }

    private void configureWebView(String appUrl) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        if (Build.VERSION.SDK_INT >= 21) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return handleExternalUrl(uri, appUrl);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(Uri.parse(url), appUrl);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) {
                    progressBar.setProgress(newProgress);
                    progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT < 21) {
                    return;
                }
                if (hasAudioPermission()) {
                    request.grant(request.getResources());
                    return;
                }
                pendingPermissionRequest = request;
                if (Build.VERSION.SDK_INT >= 23) {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO_PERMISSION);
                }
            }
        });

        webView.setOnLongClickListener(v -> {
            showServerActions();
            return true;
        });
    }

    private boolean handleExternalUrl(Uri uri, String appUrl) {
        Uri appUri = Uri.parse(appUrl);
        String appHost = appUri.getHost();
        String targetHost = uri.getHost();
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();

        if (("http".equals(scheme) || "https".equals(scheme)) && appHost != null && appHost.equalsIgnoreCase(targetHost)) {
            return false;
        }

        if ("mailto".equals(scheme) || "tel".equals(scheme)) {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        }

        return true;
    }

    private void showServerActions() {
        new AlertDialog.Builder(this)
            .setTitle("Dr. Logo")
            .setMessage("Сервер проекта:\n" + projectServerUrl)
            .setPositiveButton("Обновить", (dialog, which) -> {
                if (webView != null) webView.reload();
            })
            .setNegativeButton("Закрыть", null)
            .show();
    }

    private void showStartupError(FrameLayout root, Throwable throwable) {
        TextView error = new TextView(this);
        error.setText("Dr. Logo не смог открыть Android WebView.\n\n"
            + throwable.getClass().getSimpleName() + ": " + throwable.getMessage()
            + "\n\nОбновите Android System WebView / Chrome и запустите приложение снова.");
        error.setTextSize(16);
        error.setGravity(Gravity.CENTER);
        error.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.addView(error, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private String normalizeUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
