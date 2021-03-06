const container = document.querySelector(".container");
let gridSize = 25;
let count = 0;
let isDragging = false;
let isLeft = true;
let isRight = true;
let isDown = true;
let isLeftDown = true;
let isRightDown = true;


createGrid();

function createGrid() {
  for (i = 0; i < gridSize; i++) {
    for (j = 0; j < gridSize; j++) {
      const pixel = document.createElement("div");
      pixel.setAttribute("data-id", `${count}`);

      if (i == gridSize - 1 || j == 0 || j == gridSize - 1) {
        pixel.classList.add("walls");
      }
      container.appendChild(pixel);

      waterMovement(pixel);
      count++;
    }
  }

  let gridTemplate = `repeat(${gridSize},1fr)`;

  container.style.gridTemplateColumns = gridTemplate;
  container.addEventListener("dragstart", (e) => e.preventDefault());
}

function waterMovement(pixel) {
  pixel.addEventListener("mousedown", mouseDownFunc);
  pixel.addEventListener("mouseover", (e) => {
    if (isDragging) {
      let currentPixel = e.target;
      currentPixel.classList.add("active");

      setInterval(() => {
        let currentPosition = currentPixel.dataset.id;
        currentPixel.classList.remove("active");
        checkSurrounding(currentPosition);
        currentPosition = getNextPixelPosition(currentPosition);
      console.log({currentPosition})
      console.log({isLeft,isRight,isDown,isLeftDown,isRightDown})
        let nextPixel = document.querySelector(`[data-id="${currentPosition}"]`);
        nextPixel.classList.add("active");
        currentPixel = nextPixel;
      }, 200);
    }
  });
  pixel.addEventListener("mouseup", mouseUpFunc);
}

function mouseDownFunc() {
  isDragging = true;
}

function mouseUpFunc() {
  isDragging = false;
}
function getNextPixelPosition(currentPosition) {
  if (isDown === true) {
    return parseInt(currentPosition) + gridSize;
  }
  if (isLeftDown === true) {
    return parseInt(currentPosition) + gridSize - 1;
  }
  if (isLeft === true) {
    return parseInt(currentPosition) - 1;
  }
  if (isRightDown === true) {
    return parseInt(currentPosition) + gridSize + 1;
  }
  if (isRight === true) {
    return parseInt(currentPosition) + 1;
  }
  else return parseInt(currentPosition)
}

function checkSurrounding(currentPosition) {

  isLeft = true;
  isRight = true;
  isDown = true;
  isLeftDown = true;
  isRightDown = true;
  nextDownPos = parseInt(currentPosition) + gridSize;
  nextLeftDownPos = parseInt(currentPosition) + gridSize - 1;
  nextLeftPos = parseInt(currentPosition) - 1;
  nextRightDownPos = parseInt(currentPosition) + gridSize + 1;
  nextRightPos = parseInt(currentPosition) + 1;
  let nextDownPixel = document.querySelector(`[data-id="${nextDownPos}"]`);
  let nextLeftPixel = document.querySelector(`[data-id="${nextLeftPos}"]`);
  let nextRightPixel = document.querySelector(`[data-id="${nextRightPos}"]`);
  let nextLeftDownPixel = document.querySelector(`[data-id="${nextLeftDownPos}"]`);
  let nextRightDownPixel = document.querySelector(`[data-id="${nextRightDownPos}"]`);
  if (
    nextDownPixel.classList.contains("active") ||  nextDownPixel.classList.contains("walls") 
  ) {
    isDown = false;
  }
  if (
    nextLeftPixel.classList.contains("active") || nextLeftPixel.classList.contains("walls")
  ) {
    isLeft = false;
  }

  if (nextLeftDownPixel.classList.contains("active")  || nextLeftDownPixel.classList.contains("walls") ) {
    isLeftDown = false;
  }
  if (
    nextRightPixel.classList.contains("active") || nextRightPixel.classList.contains("walls") 
  ) {
    isRight = false;
  }
  if (nextRightDownPixel.classList.contains("active") ||  nextRightDownPixel.classList.contains("walls") ) {
    isRightDown = false;
  }
}
