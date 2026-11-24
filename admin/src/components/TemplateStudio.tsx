'use client';

import { useActionState, useState } from 'react';
import { saveTemplate, deleteTemplate, type StudioStatus, type TplState } from '@/app/(dash)/templates/actions';
import type { TemplateData } from '@/lib/templateData';
import { ArtUpload } from './ArtUpload';
import { AudioCropper } from './AudioCropper';
import { Choice, Field, More, Section, Stepper } from './formKit';
import { LayoutPicker, LayoutSketch, type LayoutOption, FREE_LAYOUT } from './LayoutPicker';
import { LivePreview } from './LivePreview';
import { VideoDesigner } from './VideoDesigner';
import { SongDesigner } from './SongDesigner';
import { PromptField } from './PromptField';
import { StudioPanel } from './StudioPanel';

type Cat = { id: string; name: string; emoji: string | null };
type Tier = { id: string; price_inr: number };

const SONG_LABEL: Record<string, string> = {
  both: 'AI song or the user’s own', ai: 'AI song', upload: 'The user’s own song',
  fixed: 'Same song for everyone', none: 'No song',
};
const SONG_OPTIONS = [
  { value: 'both', label: 'User chooses', hint: 'AI song or their own' },
  { value: 'ai', label: 'AI song', hint: 'Made for each video' },
  { value: 'upload', label: 'User’s own song', hint: 'They upload it' },
  { value: 'fixed', label: 'Same song for all', hint: 'You upload it. Free.' },
  { value: 'none', label: 'No song', hint: 'Silent video' },
];

export function TemplateStudio({
  t, categories, tiers, layouts, isImage, canDelete, studio, songUrl, artUrl,
}: {
  t: TemplateData; categories: Cat[]; tiers: Tier[]; layouts: LayoutOption[]; isImage: boolean;
  canDelete: boolean; studio: StudioStatus | null; songUrl: string | null; artUrl: string | null;
}) {
  const [state, action, pending] = useActionState<TplState, FormData>(saveTemplate, {});
  const options = layouts.filter((l) => (l.kind === 'image') === isImage);
  const [name, setName] = useState(t.name);
  const [categoryId, setCategoryId] = useState(t.category_id);
  const [description, setDescription] = useState(t.description);
  // Not editable here any more: kept as saved and sent back through hidden inputs (see below).
  const { color_from: colorFrom, color_to: colorTo, video_prompt: videoPrompt, style, duration_sec: duration } = t;
  const custom = t.custom_price_inr ? String(t.custom_price_inr) : '';
  const original = t.original_price_inr ? String(t.original_price_inr) : '';
  const [layoutId, setLayoutId] = useState(t.layout_id ?? (t.id ? '' : options[0]?.id ?? ''));
  const [songPrompt, setSongPrompt] = useState(t.song_prompt);
  const [songMode, setSongMode] = useState(t.song_mode);
  const [min, setMin] = useState(t.photos_min);
  const [max, setMax] = useState(t.photos_max);
  const [tierId, setTierId] = useState(t.price_tier_id);
  const [bgUrl, setBgUrl] = useState<string | null>(artUrl);

  const layout = options.find((l) => l.id === layoutId) ?? null;
  const category = categories.find((c) => c.id === categoryId);
  const customNum = Number(custom) > 0 ? Math.round(Number(custom)) : null;
  const tierPrice = tiers.find((x) => x.id === tierId)?.price_inr ?? null;
  const price = customNum ?? tierPrice;
  const usesAi = songMode === 'ai' || songMode === 'both';
  const hasSongPart = !isImage && songMode !== 'none';
  const setMinSafe = (v: number) => { setMin(v); if (v > max) setMax(v); };
  const setMaxSafe = (v: number) => { setMax(v); if (v < min) setMin(v); };
  let n = 0;

  return (
    <div className="space-y-4">
      <form action={action} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {t.id && <input type="hidden" name="id" value={t.id} />}

        <div className="min-w-0 space-y-4">
          <Section n={++n} title="Name your template" hint="Users see this in the app.">
            <Field label="Template name">
              <input name="name" value={name} onChange={(e) => setName(e.target.value)} className="input" required maxLength={60} placeholder="e.g. Filmy Birthday Blast" />
            </Field>
            <Field label="Category" hint="The app shows the template under this category.">
              <Choice
                name="category_id" value={categoryId} onChange={setCategoryId} columns="sm:grid-cols-4"
                options={categories.map((c) => ({ value: c.id, label: c.name, emoji: c.emoji }))}
              />
              {categories.length === 0 && <p className="mt-2 text-sm text-danger">No categories yet. Add one in Categories first.</p>}
            </Field>
            <Field label="Short description" hint="One line under the name in the app. Optional.">
              <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="input" maxLength={300} />
            </Field>
          </Section>

          <Section
            n={++n} title={isImage ? 'Pick a photo layout' : 'Photos and background'}
            hint={isImage ? (layout ? `Users add exactly ${layout.photo_count} photo${layout.photo_count > 1 ? 's' : ''}.` : 'Choose how photos are placed.') : 'Set how many photos users add and the background.'}
          >
            {isImage
              ? <LayoutPicker layouts={options} value={layoutId} onChange={setLayoutId} allowNone={!!t.id && !t.layout_id} />
              : (
                <Field label="Decorative frame" hint="Free design = the video design decides where every photo goes. A frame puts every photo in the same bordered box.">
                  <LayoutPicker layouts={options} value={layoutId} onChange={setLayoutId} allowNone={!!t.id && !t.layout_id} />
                </Field>
              )}

            {!isImage && (
              <Field label="How many photos can users add?" hint={`Every photo becomes one scene. The video is always ${duration} seconds long.`}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-3"><span className="text-sm text-ink-muted">At least</span><Stepper name="photos_min" value={min} onChange={setMinSafe} min={1} max={10} /></div>
                  <div className="flex items-center gap-3"><span className="text-sm text-ink-muted">At most</span><Stepper name="photos_max" value={max} onChange={setMaxSafe} min={1} max={10} /></div>
                </div>
              </Field>
            )}

            {/* No colour picker any more. The saved colours are kept (the save needs them, and they paint the template's gradient). */}
            <input type="hidden" name="color_from" value={colorFrom} />
            <input type="hidden" name="color_to" value={colorTo} />

            <Field label="Background picture (optional)" hint="Without one, the template's own colours make a plain gradient.">
              <ArtUpload initialPath={t.art_upload_path} initialUrl={artUrl} onPreview={setBgUrl} />
            </Field>
          </Section>

          {!isImage && (
            <Section n={++n} title="Choose the song" hint="AI songs cost a little. Your own song is free.">
              <Choice name="song_mode" value={songMode} onChange={setSongMode} options={SONG_OPTIONS} columns="sm:grid-cols-3" />
              {usesAi && (
                <div className="space-y-3">
                  <PromptField
                    name="song_prompt" label="What should the song be like?" value={songPrompt} onChange={setSongPrompt}
                    keys={['name', 'sender', 'fun_fact', 'occasion']}
                    placeholder={'e.g. "Upbeat Bollywood dhol-pop birthday song for {name}. Sing {name}\'s name in the chorus and mention {fun_fact}. Cheerful, filmy, ends with a warm wish from {sender}."'}
                    help="Tap a tag to add the user's details. It is filled in for each video."
                  />
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input type="checkbox" name="song_instrumental" defaultChecked={t.song_instrumental} className="h-4 w-4" /> Music only, no singing
                  </label>
                </div>
              )}
              {songMode !== 'none' && (
                <Field
                  label={songMode === 'fixed' ? 'Upload the song (required)' : 'Upload a sample song (optional)'}
                  hint={`Upload a full song, then drag to pick the ${duration}-second part. ${songMode === 'fixed' ? 'Every video uses this part.' : 'The preview uses it, so you do not pay for an AI sample.'}`}
                >
                  <AudioCropper windowSec={duration} initialPath={t.default_song_path} initialUrl={songUrl} initialStart={t.default_song_start_sec} />
                </Field>
              )}
            </Section>
          )}

          {!isImage && (
            <Section n={++n} title="Design the video" hint="Pick a starter template, or paste the JSON from the JSON2Video Editor. Photos, names and the song are swapped in for every video.">
              <VideoDesigner
                id={t.id} initialJson={t.movie_json} photosMin={min} photosMax={max}
                onPhotos={(a, b) => { setMin(a); setMax(b); }}
              />
            </Section>
          )}

          <Section n={++n} title="Set the price">
            <Choice
              name="price_tier_id" value={tierId} onChange={setTierId} columns="sm:grid-cols-4"
              options={tiers.map((p) => ({ value: p.id, label: `₹${p.price_inr}` }))}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="trending" defaultChecked={t.trending} className="h-4 w-4" /> Show a “Trending” badge</label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={t.is_active} className="h-4 w-4" /> Show in the app once published</label>
            </div>
          </Section>

          {/* Tags, custom price, old price, length, style and the opening/closing text are no longer editable here.
              Their saved values are sent back unchanged, because the save needs them. */}
          <input type="hidden" name="tags" value={t.tags.join(', ')} />
          <input type="hidden" name="custom_price_inr" value={custom} />
          <input type="hidden" name="original_price_inr" value={original} />
          <input type="hidden" name="duration_sec" value={isImage ? 15 : duration} />
          <input type="hidden" name="style" value={style} />
          {isImage ? (
            <>
              <input type="hidden" name="photos_min" value={layout?.photo_count ?? 1} />
              <input type="hidden" name="photos_max" value={layout?.photo_count ?? 1} />
            </>
          ) : (
            <input type="hidden" name="video_prompt" value={videoPrompt} />
          )}

          {!isImage && (
            <More
              title="Shared song + spoken name (optional)" hint="One song for the whole template; the name is spoken over it."
              defaultOpen={!!t.song_json}
            >
              <SongDesigner
                id={t.id} initialJson={t.song_json} initialStatus={t.song_status} initialError={t.song_error}
                durationSec={duration} songUrl={songUrl}
              />
            </More>
          )}
          {isImage && <input type="hidden" name="video_prompt" value="" />}
          {isImage && <input type="hidden" name="song_mode" value="none" />}

          <More title="Expert settings" hint="Raw video settings (JSON). Most people never need this.">
            <textarea name="render_config" defaultValue={JSON.stringify(t.render_config ?? {}, null, 2)} rows={4} className="input font-mono text-xs" />
            <p className="text-xs text-ink-faint">Optional overrides like {'{"font":"Poppins","transition":"slideleft"}'}.</p>
          </More>
        </div>

        <aside className="card space-y-3 p-4 lg:sticky lg:top-4">
          <h2 className="text-base font-bold">Live preview</h2>
          <LivePreview
            name={name} emoji={category?.emoji ?? '🎁'} categoryName={category?.name ?? ''} colorFrom={colorFrom} colorTo={colorTo}
            slots={layout?.id === FREE_LAYOUT ? [] : layout?.slots ?? []} isImage={isImage} photosMin={min} photosMax={max} durationSec={duration}
            videoPrompt={videoPrompt} price={price} originalPrice={Number(original) > 0 ? Number(original) : null} bgUrl={bgUrl}
            songLabel={hasSongPart ? SONG_LABEL[songMode] : isImage ? 'Not used (photo template)' : SONG_LABEL.none} description={description}
          />
        </aside>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg/90 p-3 backdrop-blur lg:col-span-2">
          <button className="btn-glass min-h-[44px]" name="intent" value="save" disabled={pending}>{pending ? 'Saving…' : t.id ? 'Save changes' : 'Save draft'}</button>
          <button className="btn-primary min-h-[44px]" name="intent" value="preview" disabled={pending}>Save and make preview video</button>
          {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
          {state.ok && <p className="text-sm text-ok" role="status">{state.message ?? 'Saved'}</p>}
          {!t.id && <p className="text-xs text-ink-faint">The real video appears below after you save.</p>}
        </div>
      </form>

      {t.id && studio && t.layout_id && layout && (
        <StudioPanel id={t.id} initial={studio} slots={layout.id === FREE_LAYOUT ? [] : layout.slots} isImage={isImage} />
      )}
      {t.id && !t.layout_id && (
        <p className="card p-4 text-sm text-ink-muted">
          This is a classic template (no layout). Pick a layout above and save to upgrade it.
          It stays live as it is until you do.
        </p>
      )}
      {t.id && canDelete && <DeleteTemplate id={t.id} />}
    </div>
  );
}

function DeleteTemplate({ id }: { id: string }) {
  const [state, action, pending] = useActionState<TplState, FormData>(deleteTemplate, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger" disabled={pending}>Delete template</button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}

export { LayoutSketch };
