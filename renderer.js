const information = document.getElementById("info");
information.innerText = `本应用正在使用 Chrome (v${app.chrome()}), Node.js (v${app.node()}), 和 Electron (v${app.electron()})`;

const func = async () => {
  const response = await window.app.ping("Hello from renderer");
  console.log(response);
};

func();
