const captions = [
  { time: 21.0, text: "Meri nazar ka safar tujh pe hi aake ruka" },
  { time: 31.0, text: "Kehne ko baaki hai kya kehna tha jo keh chuka" },
  { time: 39.3, text: "Meri nigaahein hain teri nigahon ko" },
  { time: 44.5, text: "Tujhe khabar kya bekhabar" },
  { time: 52.4, text: "Tu aati hai seene mein jab jab saansein bharta hoon" },
  { time: 62.3, text: "Tere dil ki galiyon se main har roz guzarta hoon" },
  { time: 71.3, text: "Hawa ke jaisi chalti hai tu, main ret jaisa udta hoon" },
  { time: 81.3, text: "Kaun tujhe yun pyaar karega jaise main karta hoon" },
  { time: 91.3, text: "hmmmm.... hmmmm....." }
];

const song = document.querySelector("#garden-song");
const caption = document.querySelector(".song-caption");

function updateCaption() {
  const currentCaption = captions.reduce(
    (activeCaption, item) => item.time <= song.currentTime ? item : activeCaption,
    null
  );
  const nextText = currentCaption ? currentCaption.text : "";

  if (caption.textContent !== nextText) {
    caption.textContent = nextText;
    caption.classList.toggle("is-visible", Boolean(nextText));
  }
}

function startSong() {
  song.play().catch((error) => {
    console.error("The browser could not autoplay the song.", error);
  });
}

song.addEventListener("timeupdate", updateCaption);
song.addEventListener("seeked", updateCaption);
song.addEventListener("error", () => {
  console.error("The song could not be loaded.", song.error);
});

onload = () => {
  document.body.classList.remove("container");
  startSong();
};
