import Script from "next/script";

export default function NaverAnalytics() {
  return (
    <>
      <Script
        id="naver-analytics-src"
        src="//wcs.pstatic.net/wcslog.js"
        strategy="afterInteractive"
      />
      <Script id="naver-analytics-init" strategy="afterInteractive">
        {`
          if (!window.wcs_add) window.wcs_add = {};
          window.wcs_add["wa"] = "1c58446bda19f00";
          if (window.wcs) {
            window.wcs_do();
          }
        `}
      </Script>
    </>
  );
}
