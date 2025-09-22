// AdInMoIapProxy.cs
// Unity-style extension method for seamless AdInMo IAPBoost integration
// Usage: UnityPurchasing.InitializeWithAdInMo(this, builder);
# if ADINMO_UNITY_STORE_V4
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.Purchasing;
using UnityEngine.Purchasing.Extension;
using Adinmo; // from AdInMo SDK

/// <summary>
/// Extension methods for Unity Purchasing to enable AdInMo IAPBoost integration
/// </summary>
public static class UnityPurchasingAdInMoExtensions
{
    /// <summary>
    /// Initialize Unity Purchasing with AdInMo IAPBoost support in a single call
    /// </summary>
    /// <param name="listener">Your IStoreListener implementation</param>
    /// <param name="builder">Unity IAP ConfigurationBuilder</param>
    public static void InitializeWithAdInMo(IStoreListener listener, ConfigurationBuilder builder)
    {
        AdinmoManager.Sender?.LogInfo("Initializing Unity Purchasing with AdInMo IAPBoost support...");
        AdInMoIapProxy.Register();
        
        // Use newer IDetailedStoreListener API to avoid deprecation warnings
        var wrappedListener = AdInMoIapProxy.Wrap(listener);
        if (wrappedListener is IDetailedStoreListener detailedListener)
        {
            UnityPurchasing.Initialize(detailedListener, builder);
        }
        else
        {
            // Fallback for compatibility
            #pragma warning disable CS0618
            UnityPurchasing.Initialize(wrappedListener, builder);
            #pragma warning restore CS0618
        }
    }


}

/// <summary>
/// Internal proxy that handles AdInMo IAPBoost callbacks and reporting
/// </summary>
internal static class AdInMoIapProxy
{
    /// <summary>
    /// Wraps an IStoreListener with AdInMo reporting capabilities
    /// </summary>
    public static IStoreListener Wrap(IStoreListener inner) => new Proxy(inner);

    /// <summary>
    /// Registers all AdInMo IAPBoost callbacks
    /// </summary>
    public static void Register()
    {
        if (_registered) return;
        _registered = true;

        AdinmoManager.Sender?.LogInfo("Registering AdInMo IAPBoost callbacks...");

        // 1) When an AdInMo UI/ad requests a purchase, start Unity IAP for that SKU
        AdinmoManager.SetInAppPurchaseCallback(OnAdInMoPurchaseRequested);

        // 2) Let AdInMo show localized store prices in their magnifier CTA
        AdinmoManager.SetInAppPurchaseGetPriceCallback(GetLocalizedPriceString);

        // 3) Let AdInMo know if a non-consumable is already owned (for gating UI/serving)
        // Use boolean callback for maximum compatibility across AdInMo SDK versions
        AdinmoManager.SetInAppPurchasedAlreadyCallback((string iapId) =>
        {
            // Fallback: try to get controller from Unity IAP if proxy wasn't initialized properly
            if (_controller == null)
            {
                TryGetControllerFromUnityIAP();
            }
            
            var product = _controller?.products?.WithID(iapId);
            bool isPurchased = product != null && product.hasReceipt;

            AdinmoManager.Sender?.LogInfo($"Already purchased check for {iapId}: {isPurchased}");
            if(isPurchased)
                return new InAppAlreadyPurchasedReply(true, (float)product.metadata.localizedPrice, product.metadata.isoCurrencyCode);
            return new InAppAlreadyPurchasedReply(false);
        });

        AdinmoManager.Sender?.LogInfo("All callbacks registered successfully!");
    }

    /// <summary>
    /// Validates that all requested product IDs are properly configured in Unity IAP
    /// Call this after IAP initialization for debugging purposes
    /// </summary>
    public static void ValidateProductConfiguration()
    {
        if (_controller?.products?.all == null)
        {
            AdinmoManager.Sender?.LogWarning("Cannot validate products - IAP not initialized");
            return;
        }

        var registeredProducts = _controller.products.all.Select(p => p.definition.id).ToArray();
        AdinmoManager.Sender?.LogInfo($"Registered Unity IAP Products: [{string.Join(", ", registeredProducts)}]");
        AdinmoManager.Sender?.LogInfo(" Ensure all AdInMo campaign SKU IDs match these product IDs to avoid purchase failures");

        #if UNITY_EDITOR
        AdinmoManager.Sender?.LogInfo("💡 TIP: Check your AdInMo dashboard campaigns and verify all SKU IDs are listed above");
        #endif
    }

    // ---- internal state ----
    static bool _registered;
    static IStoreController _controller;
    
    /// <summary>
    /// Fallback method to get the controller when proxy initialization was bypassed
    /// </summary>
    static void TryGetControllerFromUnityIAP()
    {
        try
        {
            // Try to get the controller from any active StoreHandler instances
            var storeHandlers = UnityEngine.Object.FindObjectsOfType<MonoBehaviour>();
            foreach (var handler in storeHandlers)
            {
                // Look for StoreController field/property in active components
                var storeControllerField = handler.GetType().GetField("StoreController", 
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                
                if (storeControllerField != null)
                {
                    var controller = storeControllerField.GetValue(handler) as IStoreController;
                    if (controller != null)
                    {
                        _controller = controller;
                        AdinmoManager.Sender?.LogInfo("Found and set controller from StoreHandler fallback");
                        return;
                    }
                }
            }

            AdinmoManager.Sender?.LogWarning("Could not find active StoreController via fallback method");
        }
        catch (Exception ex)
        {
            AdinmoManager.Sender?.LogError($"Error in fallback controller lookup: {ex.Message}");
        }
    }

    // ---- AdInMo callbacks ----

    static void OnAdInMoPurchaseRequested(string iapId)
    {
        AdinmoManager.Sender?.LogInfo($"Purchase requested from AdInMo for: {iapId}");
        
        // Fallback: try to get controller from Unity IAP if proxy wasn't initialized properly
        if (_controller == null)
        {
            TryGetControllerFromUnityIAP();
        }
        
        if (_controller == null) 
        {
            AdinmoManager.Sender?.LogError("Cannot process purchase - IAP not initialized yet");
            ReportPurchaseUnavailable(iapId, "IAP system not initialized");
            return; 
        }

        var product = _controller.products?.WithID(iapId);
        if (product == null)
        {
            AdinmoManager.Sender?.LogError($"Product '{iapId}' not registered in Unity IAP configuration");
            ReportPurchaseUnavailable(iapId, "Product not configured in Unity IAP");
            return;
        }

        if (!product.availableToPurchase)
        {
            AdinmoManager.Sender?.LogWarning($"Product '{iapId}' is not available for purchase");
            ReportPurchaseUnavailable(iapId, "Product not available for purchase", product);
            return;
        }

        AdinmoManager.Sender?.LogInfo($"Starting purchase for: {iapId}");
        _controller.InitiatePurchase(product);
    }

    /// <summary>
    /// Reports to AdInMo that a purchase cannot be completed due to configuration issues
    /// </summary>
    static void ReportPurchaseUnavailable(string iapId, string reason, Product product = null)
    {
        // Extract product metadata if available
        string currency = product?.metadata?.isoCurrencyCode ?? "USD";
        float price = product != null ? (float)(product.metadata?.localizedPrice ?? 0m) : 0f;

        AdinmoManager.Sender?.LogError($"Reporting purchase failure to AdInMo: {iapId} - {reason}");
        
        try 
        {
            // Report the configuration failure to AdInMo
            AdinmoManager.InAppPurchaseFailed(iapId, currency, price, reason);
        }
        catch (Exception ex)
        {
            AdinmoManager.Sender?.LogError($"Failed to report purchase unavailability to AdInMo: {ex.Message}");
        }
    }

    static string GetLocalizedPriceString(string itemId)
    {
        if (_controller == null)
        {
            TryGetControllerFromUnityIAP();
        }
        
        var p = _controller?.products?.WithID(itemId);
        var price = p?.metadata?.localizedPriceString;
        AdinmoManager.Sender?.LogInfo($"Price requested for {itemId}: {price}");
        return price;
    }

    // ---- Proxy wrapper for Unity IAP ----

    class Proxy : IDetailedStoreListener
    {
        readonly IStoreListener _inner;
        public Proxy(IStoreListener inner) { _inner = inner; }

        public void OnInitialized(IStoreController c, IExtensionProvider e)
        {
            _controller = c; // allow callbacks to query products & initiate purchases
            AdinmoManager.Sender?.LogInfo("Unity IAP initialized, store controller ready");
            _inner.OnInitialized(c, e);
        }

        public void OnInitializeFailed(InitializationFailureReason error)
        {
            AdinmoManager.Sender?.LogError($"Unity IAP initialization failed: {error}");
            #pragma warning disable CS0612
            _inner.OnInitializeFailed(error);
            #pragma warning restore CS0612
        }

        public void OnInitializeFailed(InitializationFailureReason error, string message)
        {
            AdinmoManager.Sender?.LogError($"Unity IAP initialization failed: {error} - {message}");
            _inner.OnInitializeFailed(error, message);
        }

        public PurchaseProcessingResult ProcessPurchase(PurchaseEventArgs args)
        {
            // Let game code decide success (Complete) vs Pending
            var result = _inner.ProcessPurchase(args);

            if (result == PurchaseProcessingResult.Complete)
            {
                ReportSuccess(args.purchasedProduct);
            }
            return result;
        }

        public void OnPurchaseFailed(Product product, PurchaseFailureDescription failure)
        {
            // Try calling the newer method first, fallback to older method
            try
            {
                ((IDetailedStoreListener)_inner)?.OnPurchaseFailed(product, failure);
            }
            catch
            {
                // Fallback to legacy method if newer interface not implemented
                #pragma warning disable CS0618
                _inner.OnPurchaseFailed(product, failure?.reason ?? PurchaseFailureReason.Unknown);
                #pragma warning restore CS0618
            }
            ReportFailure(product, failure?.reason.ToString());
        }

        public void OnPurchaseFailed(Product product, PurchaseFailureReason failureReason)
        {
            #pragma warning disable CS0618
            _inner.OnPurchaseFailed(product, failureReason);
            #pragma warning restore CS0618
            ReportFailure(product, failureReason.ToString());
        }

        // ---- Reporting helpers ----

        static void ReportSuccess(Product p)
        {
            if (p == null) return;
            var id   = p.definition?.id ?? "";
            var curr = p.metadata?.isoCurrencyCode ?? "";
            var amt  = (float)(p.metadata?.localizedPrice ?? 0m);
            var tx   = p.transactionID;

            AdinmoManager.Sender?.LogInfo($"Reporting success to AdInMo: {id}, {curr}, {amt}, {tx}");
            
            AdinmoManager.InAppPurchaseSuccess(id, curr, amt, tx);
        }

        static void ReportFailure(Product p, string reason)
        {
            if (p == null) return;
            var id   = p.definition?.id ?? "";
            var curr = p.metadata?.isoCurrencyCode ?? "";
            var amt  = (float)(p.metadata?.localizedPrice ?? 0m);

            AdinmoManager.Sender?.LogInfo($"Reporting failure to AdInMo: {id}, reason: {reason}");
            
            // Newer SDKs accept a failure reason parameter.
            try {
                AdinmoManager.InAppPurchaseFailed(id, curr, amt, reason);
            } catch {
                // Older SDKs without reason/source overload:
                AdinmoManager.InAppPurchaseFailed(id, curr, amt, null);
            }
        }
    }
}
#endif
