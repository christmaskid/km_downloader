# KM downloader
針對KM學習系統中公開的PPT檔案，彙整所有圖檔並合併成完整的PDF供使用者下載。
只會對台大醫學院內科網站和醫學系共筆大平台開放使用，不會有其他任何網站的權限。

## Access
### Chrome extension store
Link: https://chromewebstore.google.com/detail/km%E7%B3%BB%E7%B5%B1ppt%E4%B8%8B%E8%BC%89%E5%B0%8F%E5%B7%A5%E5%85%B7/midljoaeebpamehboknphanpdakadmll
給我星星 謝謝

### Install from source
1. Download ZIP
![alt text](assets/src_step0.png)
2. Unzip it.
3. Navigate to [chrome://extensions](chrome://extensions)
4. Turn on "developer mode" on the upper right corner.
5. Click "Load unpack" on the upper left corner and click the **inner** folder of the just unzipped directory (the folder with "manifest.json" inside).
![alt text](assets/src_step2-5.png)
![alt text](assets/src_step5.png)
6. Go to your webpage and click the extension button to find "KM downloader".
![alt text](assets/src_step6.png)
7. Click the blue button to start download/extraction. If the desired target is a video, you can hover your mouse onto the video time bar to see extraction progress.
<img src="assets/src_step7.png" alt="alt text" width="75%">

### Video download
- Resolution
You can pick the video resolution by 
    - checking the "auto-select" box: then the highest quality video source will be used
    - uncheck the box and select the resolution on your own: the current resolution will be used (showed at the rightmost of the bottom bar in the video frame)

#### If there is an index list
Screenshots will be made at the marked timestamps, and no other work will be required. You'll get a combined PDF directly.
#### If there is not index list
This is unfortunately a more difficult 
The determination of a "new page" will be according to the "difference" between two extracted frames at a fixed interval. You can adjust these parameters:
- Extraction frame rate
- Difference threshold

These two parameters will be ignored if not in this case.


## Privacy Policy
This project does not collect any user data in any form. No original slides as Powerpoint, or any other form such that each slide is not in the format of an image file will be downloaded neither.

## Copyright Policy
All users that have the permission to download the slides should be already granted the access to them in the form of online viewing or video. The slides should already be accessible by manually screenshoting every page. This plugin only accelerate the process.

If the authors of the  downloaded slides request any copyrights issues, feel free to contact gostudyforurself@gmail.com .