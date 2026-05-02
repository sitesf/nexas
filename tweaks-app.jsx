/* global React, ReactDOM */
const { useEffect } = React;

function NexasTweaks() {
  const defaults = window.__NEXAS_TWEAKS__ || { accent: 'blue', density: 'comfortable' };
  const [tweaks, setTweak] = window.useTweaks(defaults);

  useEffect(() => {
    if (window.__applyNexasTweaks) window.__applyNexasTweaks(tweaks);
  }, [tweaks]);

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection title="Accent">
        <window.TweakRadio
          label="Culoare"
          value={tweaks.accent}
          options={[
            { value: 'blue', label: 'Blue' },
            { value: 'cyan', label: 'Cyan' },
            { value: 'violet', label: 'Violet' },
            { value: 'emerald', label: 'Emerald' },
          ]}
          onChange={(v) => setTweak('accent', v)}
        />
      </window.TweakSection>
      <window.TweakSection title="Spațiere">
        <window.TweakRadio
          label="Densitate"
          value={tweaks.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Confort' },
            { value: 'spacious', label: 'Spațios' },
          ]}
          onChange={(v) => setTweak('density', v)}
        />
      </window.TweakSection>
    </window.TweaksPanel>
  );
}

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<NexasTweaks />);
