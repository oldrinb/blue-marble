/*<?xml version="1.0" encoding="utf-8"?>*/

/**
 * Author: Oldrin Bărbulescu
 * Last modified: Nov 9, 2024
 **/
 
const IMAGE_PATH = "../common-files/models/earth/";

// model, material(ambient, diffuse, emissive, specular, shininess,
// opacity), diffuse texture, emissive texture, specular + normal texture
const EARTH = [models.earth, [[0.3, 0.3, 0.3], [1.0, 1.0, 1.0],
              [1.0, 1.0, 1.0], [0.2, 0.2, 0.2], 4.0, 1.0],
              ["land_ocean_ice_", "jpg"], ["land_ocean_ice_lights_", "jpg"],
              ["land_ocean_ice_specular-normal_", "png"]];

const CLOUDS = [models.earth, [[0.0, 0.0, 0.0], [1.0, 1.0, 1.0],
               [1.0, 1.0, 1.0], [0.0, 0.0, 0.0], 0.0, 1.0],
               ["cloud_combined_", "jpg"], null, null];

// id, model, scale, rotation axis, rotation speed, model matrix
const SCENE = [[0, EARTH, [1.0, 1.0, 1.0], [0, 1, 0], 0.00003,
                glMatrix.mat4.create()],
               [1, CLOUDS, [1.03, 1.03, 1.03], [0, 1, 0], 0.00005,
                glMatrix.mat4.create()]];

// direction, ambient, diffuse, specular
const LIGHT = [[-0.82, 0.0, -0.56], [0.3, 0.3, 0.3], [1.0, 1.0, 1.0],
               [1.0, 0.941, 0.898]];

// position, lookAt, nearPlane, farPlane
const CAMERA = [[0.0, 0.0, 3.0], [0.0, 0.0, 0.0], 0.1, 15.0];

const MAX_VERT_ANGLE = 60 / 180 * Math.PI;
const DEFAULT_FIELD_OF_VIEW = 45;
const NORMAL_MAPPING = true;
const MODEL_ROT_ANGLE = -110 / 180 * Math.PI;

let canvas_, gl_, lose_context_ext_, frame_, width_, height_;
let shaderManager_, earth_, clouds_;
let earthTextureDay_, earthTextureNight_, earthSpecNormTexture_,
    cloudsTexture_, texSize_;
let camera_, cameraTranslation_, cameraRotation_;
let fieldOfView_, lastFieldOfView_, fieldOfViewStep_;
let lightDirection_, normalMapping_;

let inputCamTransZ_, inputCamRotX_, inputCamRotY_, fovInfo_, fovInfoValue_;
let inputLightRotY_, normalMappingToggle_;
let textureInfo_, textureInfoValue_, fpsInfo_, fpsInfoValue_, messageInfo_;

let isMouseButtonPressed_, isTouchScreen_;
let lastRotAngle_, vertRotAngle_, lastVertRotAngle_;
let lastCursorPos_, lastTapDistance_, doubleTapChangeSpeed_;
let timeout_, isError_, isTextureLoaded_;



function init() {
  cameraTranslation_ = [0.0, 0.0, 0.0]; cameraRotation_ = [0.0, 0.0];
  fieldOfView_ = lastFieldOfView_ = DEFAULT_FIELD_OF_VIEW;
  fieldOfViewStep_ = 5;
  lightDirection_ = normalize(LIGHT[0]);
  texSize_ = [0, 0];
  normalMapping_ = NORMAL_MAPPING;
  isMouseButtonPressed_ = isTouchScreen_ = false;
  lastCursorPos_ = lastTapDistance_ = null;
  doubleTapChangeSpeed_ = 50;
  lastRotAngle_ = [0.0, 0.0];
  vertRotAngle_ = lastVertRotAngle_ = 0.0;  
  isError_ = false;
  isTextureLoaded_ = false;

  let page = document.getElementsByClassName("main")[0];
  page.style.display = "block";
  enableInputControls(false);

  inputCamTransZ_ = document.getElementById("cam-trans-z");
  inputCamRotX_ = document.getElementById("cam-rot-x");
  inputCamRotY_ = document.getElementById("cam-rot-y");
  fovInfo_ = document.getElementById("camera-fov");
  fovInfoValue_ = fovInfo_.value;

  inputLightRotY_ = document.getElementById("light-rot-y");
  let val = (lightDirection_[2] > 0) ? 0 : Math.acos(lightDirection_[0]);
  val *= 100 / Math.PI;
  inputLightRotY_.value = val;

  normalMappingToggle_ = document.getElementById("normal-mapping");
  normalMappingToggle_.checked = normalMapping_;

  textureInfo_ = document.getElementById("tex-size");
  textureInfoValue_ = textureInfo_.value;

  fpsInfo_ = document.getElementById("fps-counter");
  fpsInfoValue_ = fpsInfo_.value;

  let elems = document.getElementsByClassName("info");
  for (let i = 0; i < elems.length; i++)
    if (elems[i].tagName == "P")
      messageInfo_ = elems[i];
  messageInfo_.innerHTML = "Loading textures ...";

  canvas_ = document.getElementById("gl-canvas");
  let attributes = {alpha: false, antialias: true, depth: true};
  gl_ = canvas_.getContext("webgl2", attributes);

  if (!gl_) {
    handleException("webgl2", null);
    return;
  }
  lose_context_ext_ = gl_.getExtension('WEBGL_lose_context');

  shaderManager_ = new ShaderManager([gl_]);

  earth_ = new Mesh([gl_], EARTH[0].positions, null, EARTH[0].texCoords,
      EARTH[0].normals, EARTH[0].tangents, EARTH[0].bitangents,
      EARTH[0].indices);
  clouds_ = new Mesh([gl_], CLOUDS[0].positions, null, CLOUDS[0].texCoords,
      CLOUDS[0].normals, CLOUDS[0].tangents, CLOUDS[0].bitangents,
      CLOUDS[0].indices);

  earthTextureDay_ = new Texture([gl_], true, 1, 1, true, true, true);
  earthTextureNight_ = new Texture([gl_], true, 1, 1, true, true, true);
  earthSpecNormTexture_ = new Texture([gl_], true, 1, 1, true, true, true);
  cloudsTexture_ = new Texture([gl_], false, 1, 1, true, true, true);

  let maxTextureSize = gl_.getParameter(gl_.MAX_TEXTURE_SIZE);
  if (maxTextureSize >= 8192) texSize_ = [8192, 4096];
  else if (maxTextureSize >= 4096) texSize_ = [4096, 2048];
  else if (maxTextureSize >= 2048) texSize_ = [2048, 1024];
  else if (maxTextureSize >= 1024) texSize_ = [1024, 512];

  let texFileName;
  Promise.all([shaderManager_.compile(),
      earth_.loadBuffers(), clouds_.loadBuffers(),

      texFileName = IMAGE_PATH + EARTH[2][0] + texSize_[0] + "." + EARTH[2][1],
      earthTextureDay_.loadImage(texFileName),
      texFileName = IMAGE_PATH + EARTH[3][0] + texSize_[0] + "." + EARTH[3][1],
      earthTextureNight_.loadImage(texFileName),
      texFileName = IMAGE_PATH + EARTH[4][0] + texSize_[0] + "." + EARTH[4][1],
      texFileName = texFileName.replace("land_ocean_ice_specular-normal_8192",
          "land_ocean_ice_specular-normal_4096"),
      earthSpecNormTexture_.loadImage(texFileName),

      texFileName=IMAGE_PATH + CLOUDS[2][0] + texSize_[0] + "." + CLOUDS[2][1],
      cloudsTexture_.loadImage(texFileName)])
    .then(function(values) {
      shaderManager_.setAttribPointers(earth_);
      shaderManager_.setAttribPointers(clouds_);

      EARTH[0] = earth_; EARTH[2] = earthTextureDay_;
      EARTH[3] = earthTextureNight_; EARTH[4] = earthSpecNormTexture_;
      CLOUDS[0] = clouds_; CLOUDS[2] = cloudsTexture_;

      camera_ = new Camera(glMatrix.vec3.fromValues(CAMERA[0][0], CAMERA[0][1],
          CAMERA[0][2]), glMatrix.vec3.fromValues(CAMERA[1][0], CAMERA[1][1],
          CAMERA[1][2]), fieldOfView_, CAMERA[2], CAMERA[3]);
      fovInfo_.value = fieldOfView_;
      updateModelMatrix();

      lightDirEye = computeLightInEyeSpace(lightDirection_);
      shaderManager_.setLightParam(lightDirEye, LIGHT[1], LIGHT[2], LIGHT[3]);
      shaderManager_.setNormalMapping(normalMapping_);

      gl_.enable(gl_.CULL_FACE);
      gl_.cullFace(gl_.BACK);
      gl_.enable(gl_.DEPTH_TEST);
      gl_.depthFunc(gl_.LESS);

      gl_.clearColor(0.0, 0.0, 0.0, 1.0);
      gl_.clearDepth(1.0);

      let errorCode = gl_.getError();
      if (errorCode != gl_.NO_ERROR)
        throw (util.getGLErrorMessage(gl_, errorCode));

      canvas_.style.display = "block";
      updateCanvasSize();

      if (!isError_) {
        enableInputControls(true);
        isTextureLoaded_ = true;
        textureInfo_.value = texSize_[0] + " x " + texSize_[1];
        messageInfo_.innerHTML = "";
        addEventListeners();

        frame_ = requestAnimationFrame(render);
      }

    })
    .catch (function(error) {
      handleException("init", error);
    });
}



function render(now) {
  fpsInfo_.value = util.getFPS(now);

  try {
    renderScene(now);

    let errorCode = gl_.getError();
    if (errorCode != gl_.NO_ERROR)
      throw (util.getGLErrorMessage(gl_, errorCode));
      
    if (!isError_) frame_ = requestAnimationFrame(render);
  }
  catch (error) {
    handleException("render", error);
  }
}



function clean() {
  if (typeof frame_ !== "undefined") cancelAnimationFrame(frame_);

  if (typeof shaderManager_ !== "undefined")
    shaderManager_.deleteProgram();

  if (typeof earth_ !== "undefined") earth_.deleteBuffers();
  if (typeof clouds_ !== "undefined") clouds_.deleteBuffers();

  if (typeof earthTextureDay_ !== "undefined")
      earthTextureDay_.deleteTexture();
  if (typeof earthTextureNight_ !== "undefined")
      earthTextureNight_.deleteTexture();
  if (typeof earthSpecNormTexture_ !== "undefined")
      earthSpecNormTexture_.deleteTexture();
  if (typeof cloudsTexture_ !== "undefined")
      cloudsTexture_.deleteTexture();

  if (typeof lose_context_ext_ !== "undefined" &&
             lose_context_ext_ !== null &&
             !gl_.isContextLost())
    lose_context_ext_.loseContext();
}



function resize() {
  if (! isTextureLoaded_) return;
  
  if (typeof timeout_ !== "undefined") {
    clearTimeout(timeout_);

    if (typeof frame_ !== "undefined") cancelAnimationFrame(frame_); 
    frame_ = undefined;
    fpsInfo_.value = fpsInfoValue_;

    gl_.clear(gl_.COLOR_BUFFER_BIT);
  }

  timeout_ = setTimeout(function() {
    updateCanvasSize();

    if (!isError_) {
      frame_ = requestAnimationFrame(render);
    }
  }, 50);
}



function reset() {
  inputCamTransZ_.value = 50;
  inputCamTransZ_.dispatchEvent(new Event("input"));

  inputCamRotX_.value = 50;
  inputCamRotX_.dispatchEvent(new Event("input"));

  inputCamRotY_.value = 50;
  inputCamRotY_.dispatchEvent(new Event("input"));

  fieldOfView_ = DEFAULT_FIELD_OF_VIEW;
  camera_.setFieldOfView(fieldOfView_);
  fovInfo_.value = fieldOfView_;

  lightDirection_ = normalize(LIGHT[0]);
  let val = (lightDirection_[2] > 0) ? 0 : Math.acos(lightDirection_[0]);
  val *= 100.0 / Math.PI;
  inputLightRotY_.value = val;
  inputLightRotY_.dispatchEvent(new Event("input"));

  normalMapping_ = NORMAL_MAPPING;
  normalMappingToggle_.checked = normalMapping_;
  normalMappingToggle_.dispatchEvent(new Event("input"));

  util.resetRotationAngle();
  vertRotAngle_ = lastVertRotAngle_ = 0.0;  
  updateModelMatrix();
}



function translateCamera(event) {
  let zRange = 3;
  let value = event.target.value;
  let mode = event.target.id;

  if (mode == "cam-trans-z") {
    value = value / 100 * 2 * zRange;
    value = zRange - value;
    value = (value > 0) ? 0.5 * value : 2 * value;
    camera_.translateForward(value - cameraTranslation_[2]);
    cameraTranslation_[2] = value;
  }

  updateModelMatrix();
  lightDirEye = computeLightInEyeSpace(lightDirection_);
  shaderManager_.setLightParam(lightDirEye, LIGHT[1], LIGHT[2], LIGHT[3]);
}



function rotateCamera(event) {
  let value = event.target.value;
  value = value / 100 * 2;
  value--;
  let mode = event.target.id;

  if (mode == "cam-rot-x") {
    value *= 90;
    try {
      camera_.rotateUp(value - cameraRotation_[0]);
      cameraRotation_[0] = value;
    }
    catch (error) { }
  }
  else if (mode == "cam-rot-y") {
    value *= 180;
    camera_.rotateRight(value - cameraRotation_[1]);
    cameraRotation_[1] = value;
  }

  updateModelMatrix();
  lightDirEye = computeLightInEyeSpace(lightDirection_);
  shaderManager_.setLightParam(lightDirEye, LIGHT[1], LIGHT[2], LIGHT[3]);
}



function changeFieldOfView(event) {
  let delta = (event.deltaY > 0) ? fieldOfViewStep_ : -fieldOfViewStep_;
  fieldOfView_ += delta;
  if (fieldOfView_ < camera_.getMinFieldOfView())
    fieldOfView_ = camera_.getMinFieldOfView();
  else if (fieldOfView_ > camera_.getMaxFieldOfView())
    fieldOfView_ = camera_.getMaxFieldOfView();

  camera_.setFieldOfView(fieldOfView_);
  fovInfo_.value = fieldOfView_;
}



function rotateLight(event) {
  let value = event.target.value;
  let angle = value / 100 * Math.PI;
  lightDirection_ = [Math.cos(angle), 0, -Math.sin(angle)];

  let lightDirEye = computeLightInEyeSpace(lightDirection_);
  shaderManager_.setLightParam(lightDirEye, LIGHT[1], LIGHT[2], LIGHT[3]);
}



function normalMapping(event) {
  normalMapping_ = event.target.checked;
  shaderManager_.setNormalMapping(normalMapping_);
}



function mouseButtonCallback(event) {
  isMouseButtonPressed_ = (event.type == "mousedown" && event.button == 0);

  if (isMouseButtonPressed_ && !lastCursorPos_) {
    lastCursorPos_ = [event.clientX, event.clientY];
    lastRotAngle_= [util.getLastRotationAngle(0), util.getLastRotationAngle(1)];
    lastVertRotAngle_ = vertRotAngle_;
  }
  else lastCursorPos_ = null;
}



function touchScreenCallback(event) {
  isTouchScreen_ = (event.type == "touchstart");

  if (isTouchScreen_ && event.touches.length == 1 && !lastCursorPos_) {
    lastCursorPos_ = [event.touches[0].clientX, event.touches[0].clientY];
    lastRotAngle_ =
        [util.getLastRotationAngle(0), util.getLastRotationAngle(1)];
    lastVertRotAngle_ = vertRotAngle_;
  }
  else lastCursorPos_ = null;

  if (isTouchScreen_ && event.touches.length == 2 && !lastTapDistance_) {
    lastTapDistance_ = Math.sqrt
        (Math.pow(event.touches[0].clientX - event.touches[1].clientX, 2) +
         Math.pow(event.touches[0].clientY - event.touches[1].clientY, 2));
    lastFieldOfView_ = fieldOfView_;
  }
  else lastTapDistance_ = null;

  event.preventDefault();
}



function cursorPositionCallback(event) {
  let deltaX, deltaY, deltaDist;

  if (isMouseButtonPressed_ && event.type == "mousemove" && lastCursorPos_) {
    deltaX = event.clientX - lastCursorPos_[0];
    deltaY = event.clientY - lastCursorPos_[1];
  }

  else if (isTouchScreen_ && event.type == "touchmove") {
    if (event.touches.length == 1 && lastCursorPos_) {
      deltaX = event.touches[0].clientX - lastCursorPos_[0];
      deltaY = event.touches[0].clientY - lastCursorPos_[1];
    }
    else if (event.touches.length == 2 && lastTapDistance_) {
      let tapDistance = Math.sqrt
          (Math.pow(event.touches[0].clientX - event.touches[1].clientX, 2) +
           Math.pow(event.touches[0].clientY - event.touches[1].clientY, 2));
      deltaDist = tapDistance - lastTapDistance_;
    }
  }

  if (typeof(deltaX) != "undefined" && typeof(deltaY) != "undefined") {
    let deltaAngleX = deltaX / width_ * Math.PI;
    let deltaAngleY = deltaY / height_ * Math.PI;
    util.setRotationAngle(0, lastRotAngle_[0] + deltaAngleX);
    util.setRotationAngle(1, lastRotAngle_[1] + deltaAngleX);

    vertRotAngle_ = lastVertRotAngle_ + deltaAngleY;
    if (vertRotAngle_ > MAX_VERT_ANGLE) vertRotAngle_ = MAX_VERT_ANGLE;
    else if (vertRotAngle_ < -MAX_VERT_ANGLE) vertRotAngle_ = -MAX_VERT_ANGLE;

    updateModelMatrix();
  }

  else if (typeof(deltaDist) != "undefined") {
    let deltaAngle = deltaDist /
        Math.max(width_, height_) *  doubleTapChangeSpeed_;

    fieldOfView_ = lastFieldOfView_ - deltaAngle;    
    let remainder = fieldOfView_ % fieldOfViewStep_;    
    if (remainder >= fieldOfViewStep_ / 2.0)
      fieldOfView_ += fieldOfViewStep_ - remainder;
    else if (remainder > 0 && remainder < fieldOfViewStep_ / 2.0)
      fieldOfView_ -= remainder;

    if (fieldOfView_ < camera_.getMinFieldOfView())
      fieldOfView_ = camera_.getMinFieldOfView();
    else if (fieldOfView_ > camera_.getMaxFieldOfView())
      fieldOfView_ = camera_.getMaxFieldOfView();

    camera_.setFieldOfView(fieldOfView_);
    fovInfo_.value = fieldOfView_;
  }
}



function renderScene(now) {
  gl_.viewport(0, 0, width_, height_);
  gl_.clear(gl_.COLOR_BUFFER_BIT | gl_.DEPTH_BUFFER_BIT);  
  
  for (let i = 0; i < SCENE.length; i++) {
    if (i == 0) gl_.disable(gl_.BLEND);
    else {
      gl_.enable(gl_.BLEND);
      gl_.blendFunc(gl_.SRC_ALPHA, gl_.ONE_MINUS_SRC_ALPHA);
    }

    renderMesh(SCENE[i], now);
  }
}



function renderMesh(m, now) {
  let id = m[0];
  let mesh = m[1][0];
  let material = m[1][1];
  let diffTexture = m[1][2];
  let emissTexture = m[1][3];
  let specNormTexture = m[1][4];
  let rotationAxis = m[3];
  let rotationSpeed = m[4];
  let modelMatrix = glMatrix.mat4.clone(m[5]);

  let ambColor = material[0];
  let diffColor = material[1];
  let emissColor = material[2];
  let specColor = material[3];
  let shininess = material[4];
  let opacity = material[5];
  shaderManager_.setMaterialParam
      (id, ambColor, diffColor, emissColor, specColor, shininess, opacity);

  let angle = util.getRotationAngle(id, now, rotationSpeed);
  glMatrix.mat4.rotate(modelMatrix, modelMatrix, angle, rotationAxis);

  let modelViewMatrix = glMatrix.mat4.create();
  let modelViewProjMatrix = glMatrix.mat4.create();
  let normalMatrix = glMatrix.mat4.create();
  glMatrix.mat4.multiply(modelViewMatrix, camera_.getViewMatrix(), modelMatrix);
  glMatrix.mat4.multiply
      (modelViewProjMatrix, camera_.getViewProjMatrix(), modelMatrix);
  glMatrix.mat4.invert(normalMatrix, modelViewMatrix);
  glMatrix.mat4.transpose(normalMatrix, normalMatrix);

  shaderManager_.render(mesh, diffTexture, emissTexture, specNormTexture,
      modelViewMatrix, modelViewProjMatrix, normalMatrix);
}



function updateCanvasSize() {
  width_  = canvas_.clientWidth;
  height_ = canvas_.clientHeight;

  if (canvas_.width  != width_ || canvas_.height != height_) {
    canvas_.width  = width_;
    canvas_.height = height_;

    try {
      camera_.setAspectRatio(width_ / height_);

      let errorCode = gl_.getError();
      if (errorCode != gl_.NO_ERROR)
        throw (util.getGLErrorMessage(gl_, errorCode));
    }
    catch(error) {
      handleException("resize", error);
    }
  }
}



function computeLightInEyeSpace(lightDir) {
  let lightPos = glMatrix.vec4.fromValues
      (-lightDir[0], -lightDir[1], -lightDir[2], 1.0);
  let lightLookAt = glMatrix.vec4.fromValues(0.0, 0.0, 0.0, 1.0);
  let lightPosEye = glMatrix.vec4.fromValues(0.0, 0.0, 0.0, 1.0);
  let lightLookAtEye = glMatrix.vec4.fromValues(0.0, 0.0, 0.0, 1.0);

  glMatrix.mat4.multiply(lightPosEye, camera_.getViewMatrix(), lightPos);
  glMatrix.mat4.multiply(lightLookAtEye, camera_.getViewMatrix(), lightLookAt);

  let lightDirEye = [lightLookAtEye[0] - lightPosEye[0],
                     lightLookAtEye[1] - lightPosEye[1],
                     lightLookAtEye[2] - lightPosEye[2]];
  return normalize(lightDirEye);
}



function updateModelMatrix() {
    let invCameraMat = glMatrix.mat3.create();
    glMatrix.mat3.fromMat4(invCameraMat, camera_.getViewMatrix());
    glMatrix.mat3.invert(invCameraMat, invCameraMat);

    let xAxis = glMatrix.vec3.fromValues(1.0, 0.0, 0.0);
    glMatrix.mat3.multiply(xAxis, invCameraMat, xAxis);

  for (let i = 0; i < SCENE.length; i++) {
      let scale = SCENE[i][2];
      let modelMatrix = glMatrix.mat4.create()
      glMatrix.mat4.scale(modelMatrix, modelMatrix, scale);
      glMatrix.mat4.rotate(modelMatrix, modelMatrix, vertRotAngle_, xAxis);
      glMatrix.mat4.rotate
          (modelMatrix, modelMatrix, MODEL_ROT_ANGLE, [0.0, 1.0, 0.0]);
      SCENE[i][5] = modelMatrix;
  }
}



function normalize([vx, vy, vz]) {
  let length = Math.sqrt(Math.pow(vx, 2) + Math.pow(vy, 2) + Math.pow(vz, 2));
  return [vx / length, vy / length, vz / length];
}



function handleException(errorCode, description) {
  isError_ = true;
  if (typeof frame_ !== "undefined") cancelAnimationFrame(frame_);

  fovInfo_.value = fovInfoValue_;
  textureInfo_.value = textureInfoValue_;
  fpsInfo_.value = fpsInfoValue_;

  removeEventListeners();
  enableInputControls(false);
  if (typeof canvas_ !== "undefined") canvas_.style.display = "none";

  messageInfo_.className = "error";
  let message = util.getErrorMessage(errorCode);
  util.displayError(message, description);
}



function addEventListeners() {
  canvas_.addEventListener("wheel", function(e) {changeFieldOfView(e);},
      {passive: true});

  canvas_.addEventListener('mousedown', mouseButtonCallback);
  canvas_.addEventListener('mouseup', mouseButtonCallback);
  canvas_.addEventListener('mouseout', mouseButtonCallback);
  canvas_.addEventListener('mousemove', cursorPositionCallback);
  canvas_.addEventListener('contextmenu', (e) => {e.preventDefault();});

  canvas_.addEventListener('touchstart', function(e) {touchScreenCallback(e);},
      {passive: false});
  canvas_.addEventListener('touchend', touchScreenCallback);
  canvas_.addEventListener('touchcancel', touchScreenCallback);
  canvas_.addEventListener('touchmove', function(e){cursorPositionCallback(e);},
      {passive: true});

  document.addEventListener('touchstart', function(e) { }, {
    passive: false
  });
}



function removeEventListeners() {
  document.body.removeAttribute("onresize");
  document.body.setAttribute("onresize", null);

  canvas_.removeEventListener("wheel", changeFieldOfView);

  canvas_.removeEventListener('mousedown', mouseButtonCallback);
  canvas_.removeEventListener('mouseup', mouseButtonCallback);
  canvas_.removeEventListener('mouseout', mouseButtonCallback);
  canvas_.removeEventListener('mousemove', cursorPositionCallback);

  canvas_.removeEventListener('touchstart', touchScreenCallback);
  canvas_.removeEventListener('touchend', touchScreenCallback);
  canvas_.removeEventListener('touchcancel', touchScreenCallback);
  canvas_.removeEventListener('touchmove', cursorPositionCallback);
}



function enableInputControls(enabled) {
  util.enableInputControl("reset-button", enabled);
  util.enableInputControl("camera", enabled);
  util.enableInputControl("light", enabled); 
  util.enableInputControl("normal-mapping", enabled);
  util.enableInputControl("tex-size", enabled);
  util.enableInputControl("fps-counter", enabled);
}
