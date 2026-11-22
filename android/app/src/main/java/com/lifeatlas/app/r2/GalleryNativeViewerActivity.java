package com.lifeatlas.app.r2;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.*;
import android.widget.*;
import androidx.annotation.NonNull;
import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager2.widget.ViewPager2;
import com.davemorrissey.labs.subscaleview.ImageSource;
import com.davemorrissey.labs.subscaleview.SubsamplingScaleImageView;
import java.util.ArrayList;
import java.util.HashSet;

/** Local MediaStore-only viewer. No bucket access, credentials, uploads or image rewriting. */
public final class GalleryNativeViewerActivity extends Activity {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ArrayList<Page> pages = new ArrayList<>();
  private ArrayList<String> ids;
  private ViewPager2 pager;
  private FrameLayout root;
  private LinearLayout top, bottom;
  private TextView counter;
  private boolean chrome = true;
  private final Runnable hide = () -> setChrome(false);

  static ArrayList<String> validate(ArrayList<String> input) {
    if (input == null || input.isEmpty() || input.size() > 2000)
      throw new IllegalArgumentException("INVALID_SELECTION");
    HashSet<String> seen = new HashSet<>();
    for (String id : input) {
      R2DeviceGallery.mediaNumber(id);
      if (!seen.add(id)) throw new IllegalArgumentException("INVALID_SELECTION");
    }
    return input;
  }

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    try {
      ids = validate(getIntent().getStringArrayListExtra("ids"));
    } catch (Exception invalid) {
      setResult(RESULT_CANCELED);
      finish();
      return;
    }
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    getWindow().setStatusBarColor(Color.BLACK);
    getWindow().setNavigationBarColor(Color.BLACK);
    SubsamplingScaleImageView.setPreferredBitmapConfig(Bitmap.Config.ARGB_8888);
    root = new FrameLayout(this);
    root.setBackgroundColor(Color.BLACK);
    pager = new ViewPager2(this);
    pager.setAdapter(
        new RecyclerView.Adapter<Page>() {
          @NonNull
          @Override
          public Page onCreateViewHolder(@NonNull ViewGroup parent, int type) {
            FrameLayout frame = new FrameLayout(GalleryNativeViewerActivity.this);
            frame.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
            Page page = new Page(frame);
            pages.add(page);
            return page;
          }

          @Override
          public void onBindViewHolder(@NonNull Page page, int position) {
            page.bind(position);
          }

          @Override
          public int getItemCount() {
            return ids.size();
          }

          @Override
          public void onViewRecycled(@NonNull Page page) {
            page.release();
          }
        });
    pager.setPageTransformer(
        (view, position) -> {
          view.setTranslationX(-dp(9) * position);
          view.setScaleX(0.97f);
        });
    root.addView(pager, new FrameLayout.LayoutParams(-1, -1));
    top = new LinearLayout(this);
    top.setGravity(Gravity.CENTER_VERTICAL);
    top.setBackgroundColor(0xc0000000);
    button(top, "‹ Back", () -> complete("close"));
    counter = new TextView(this);
    counter.setTextColor(Color.WHITE);
    counter.setTextSize(14);
    top.addView(counter, new LinearLayout.LayoutParams(-2, -2));
    FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-1, dp(56), Gravity.TOP);
    root.addView(top, tp);
    bottom = new LinearLayout(this);
    bottom.setGravity(Gravity.CENTER);
    bottom.setBackgroundColor(0xc0000000);
    button(bottom, "Share", () -> complete("share"));
    button(bottom, "Favourite", () -> complete("favourite"));
    button(bottom, "Info", () -> complete("info"));
    button(bottom, "More", () -> complete("more"));
    FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(-1, dp(64), Gravity.BOTTOM);
    root.addView(bottom, bp);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          v.setPadding(
              insets.getSystemWindowInsetLeft(),
              insets.getSystemWindowInsetTop(),
              insets.getSystemWindowInsetRight(),
              insets.getSystemWindowInsetBottom());
          return insets;
        });
    setContentView(root);
    pager.registerOnPageChangeCallback(
        new ViewPager2.OnPageChangeCallback() {
          @Override
          public void onPageSelected(int position) {
            pager.setUserInputEnabled(true);
            counter.setText((position + 1) + " / " + ids.size());
            for (Page page : pages) page.active(page.position == position);
            activity();
          }
        });
    int initial = Math.max(0, ids.indexOf(getIntent().getStringExtra("selected")));
    pager.setCurrentItem(
        state == null ? initial : Math.min(ids.size() - 1, state.getInt("position", initial)),
        false);
    counter.setText((pager.getCurrentItem() + 1) + " / " + ids.size());
    activity();
  }

  private int dp(float value) {
    return Math.round(getResources().getDisplayMetrics().density * value);
  }

  private void button(LinearLayout row, String label, Runnable action) {
    Button button = new Button(this);
    button.setText(label);
    button.setTextSize(13);
    button.setTextColor(Color.WHITE);
    button.setBackgroundColor(Color.TRANSPARENT);
    button.setContentDescription(label);
    button.setOnClickListener(
        v -> {
          activity();
          action.run();
        });
    row.addView(button, new LinearLayout.LayoutParams(0, -1, 1));
  }

  private void activity() {
    setChrome(true);
    handler.removeCallbacks(hide);
    handler.postDelayed(hide, 3000);
  }

  private void setChrome(boolean visible) {
    chrome = visible;
    if (top == null) return;
    for (View view : new View[] {top, bottom}) {
      view.animate().cancel();
      view.animate().alpha(visible ? 1 : 0).setDuration(180).start();
      view.setImportantForAccessibility(
          visible
              ? View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
              : View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
      view.setVisibility(View.VISIBLE);
      view.setEnabled(visible);
      if (view instanceof ViewGroup)
        for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++)
          ((ViewGroup) view).getChildAt(i).setEnabled(visible);
    }
  }

  private void complete(String action) {
    setResult(
        RESULT_OK,
        new Intent().putExtra("id", ids.get(pager.getCurrentItem())).putExtra("action", action));
    finish();
  }

  @Override
  public void onBackPressed() {
    complete("close");
  }

  @Override
  protected void onSaveInstanceState(Bundle state) {
    state.putInt("position", pager.getCurrentItem());
    super.onSaveInstanceState(state);
  }

  @Override
  protected void onPause() {
    super.onPause();
    for (Page page : pages) page.active(false);
    handler.removeCallbacks(hide);
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (pager != null) for (Page page : pages) page.active(page.position == pager.getCurrentItem());
  }

  @Override
  protected void onDestroy() {
    handler.removeCallbacksAndMessages(null);
    for (Page page : pages) page.release();
    super.onDestroy();
  }

  private final class Page extends RecyclerView.ViewHolder {
    final FrameLayout frame;
    int position = -1;
    SubsamplingScaleImageView photo;
    PlayerView video;
    ExoPlayer player;
    long resumeAt;
    float startX, startY;
    boolean vertical, multiple;

    Page(FrameLayout frame) {
      super(frame);
      this.frame = frame;
    }

    void bind(int at) {
      release();
      position = at;
      resumeAt = 0;
      String id = ids.get(at);
      try {
        if (id.startsWith("image:")) {
          photo = new SubsamplingScaleImageView(GalleryNativeViewerActivity.this);
          photo.setOrientation(SubsamplingScaleImageView.ORIENTATION_USE_EXIF);
          photo.setMinimumScaleType(SubsamplingScaleImageView.SCALE_TYPE_CENTER_INSIDE);
          photo.setDoubleTapZoomDuration(240);
          photo.setMaxScale(8);
          photo.setImage(ImageSource.uri(R2DeviceGallery.uri(id)));
          photo.setOnImageEventListener(
              new SubsamplingScaleImageView.DefaultOnImageEventListener() {
                @Override
                public void onImageLoadError(Exception error) {
                  unavailable();
                }
              });
          photo.setOnClickListener(v -> setChrome(!chrome));
          photo.setOnTouchListener((v, e) -> gesture(e));
          frame.addView(photo, new FrameLayout.LayoutParams(-1, -1));
        } else {
          video = new PlayerView(GalleryNativeViewerActivity.this);
          video.setKeepContentOnPlayerReset(true);
          video.setControllerAutoShow(false);
          video.setControllerShowTimeoutMs(2500);
          video.setOnTouchListener((v, e) -> gesture(e));
          // Reserve the action bar's area so the player's seek/fullscreen controls
          // remain visible and touchable; photo pages keep their full-height canvas.
          FrameLayout.LayoutParams videoLayout = new FrameLayout.LayoutParams(-1, -1);
          videoLayout.bottomMargin = dp(64);
          frame.addView(video, videoLayout);
        }
        active(at == pager.getCurrentItem());
      } catch (Exception unavailable) {
        unavailable();
      }
    }

    void unavailable() {
      TextView text = new TextView(GalleryNativeViewerActivity.this);
      text.setText("This file could not be opened. Tap More to use Atlas tools.");
      text.setTextColor(Color.WHITE);
      text.setGravity(Gravity.CENTER);
      frame.addView(text, new FrameLayout.LayoutParams(-1, -1));
    }

    boolean gesture(MotionEvent e) {
      if (e.getActionMasked() == MotionEvent.ACTION_DOWN) {
        startX = e.getX();
        startY = e.getY();
        vertical = false;
        multiple = false;
      }
      if (e.getPointerCount() > 1) {
        multiple = true;
        pager.setUserInputEnabled(false);
      }
      boolean zoomed =
          photo != null && photo.isReady() && photo.getScale() > photo.getMinScale() * 1.03f;
      float dx = e.getX() - startX, dy = e.getY() - startY;
      if (!multiple
          && !zoomed
          && e.getActionMasked() == MotionEvent.ACTION_MOVE
          && Math.abs(dy) > dp(18)
          && Math.abs(dy) > Math.abs(dx) * 1.5) {
        vertical = true;
        pager.setUserInputEnabled(false);
        setChrome(false);
        frame.setTranslationY(dy);
        frame.setScaleX(1 - Math.min(.12f, Math.abs(dy) / dp(3000)));
        frame.setScaleY(frame.getScaleX());
      }
      if (e.getActionMasked() == MotionEvent.ACTION_UP
          || e.getActionMasked() == MotionEvent.ACTION_CANCEL) {
        boolean finish =
            vertical && e.getActionMasked() == MotionEvent.ACTION_UP && Math.abs(dy) > dp(120);
        pager.setUserInputEnabled(!zoomed);
        frame.animate().translationY(0).scaleX(1).scaleY(1).setDuration(180).start();
        if (finish) complete(dy > 0 ? "close" : "whatsapp");
        return vertical;
      }
      if (zoomed) pager.setUserInputEnabled(false);
      return vertical;
    }

    void active(boolean active) {
      if (video == null) return;
      if (!active) {
        if (player != null) {
          resumeAt = player.getCurrentPosition();
          video.setPlayer(null);
          player.release();
          player = null;
        }
        return;
      }
      if (player == null) {
        try {
          player = new ExoPlayer.Builder(GalleryNativeViewerActivity.this).build();
          video.setPlayer(player);
          player.setMediaItem(MediaItem.fromUri(R2DeviceGallery.uri(ids.get(position))));
          player.setVolume(0);
          player.seekTo(resumeAt);
          player.prepare();
          player.setPlayWhenReady(true);
        } catch (Exception error) {
          unavailable();
        }
      }
    }

    void release() {
      if (player != null) {
        player.release();
        player = null;
      }
      if (photo != null) {
        photo.recycle();
        photo = null;
      }
      video = null;
      frame.removeAllViews();
      frame.setTranslationY(0);
      frame.setScaleX(1);
      frame.setScaleY(1);
    }
  }
}
