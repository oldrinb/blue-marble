/*<?xml version="1.0" encoding="utf-8"?>*/

/**
 * Interface between the JavaScript 'main.js' file and GLSL shaders.
 * Author: Oldrin Bărbulescu
 * Last modified: Nov 6, 2024
 **/

function ShaderManager([gl]) {
  this.compile = function() {
    return program_.compile()
      .then(function(value) {
        mPosition_ = program_.getAttribLocation("mPosition");
        texCoord_ = program_.getAttribLocation("vTexCoord");
        mNormal_ = program_.getAttribLocation("mNormal");
        mTangent_ = program_.getAttribLocation("mTangent");
        mBitangent_ = program_.getAttribLocation("mBitangent");

        modelViewMatrix_ = program_.getUniformLocation("modelViewMatrix");
        modelViewProjMatrix_ =
            program_.getUniformLocation("modelViewProjMatrix");
        normalMatrix_ = program_.getUniformLocation("normalMatrix");

        diffTexSampler_  = program_.getUniformLocation("diffTexSampler");
        emissTexSampler_  = program_.getUniformLocation("emissTexSampler");
        specNormTexSampler_ = program_.getUniformLocation("specNormTexSampler");

        material_ = {
          id: program_.getUniformLocation("material.id"),
          diffColor: program_.getUniformLocation("material.diffColor"),
          emissColor: program_.getUniformLocation("material.emissColor"),
          specColor: program_.getUniformLocation("material.specColor"),
          shininess: program_.getUniformLocation("material.shininess"),
          opacity: program_.getUniformLocation("material.opacity")
        }

        light_ = {
          eDirection: program_.getUniformLocation("light.eDirection"),
          diffColor: program_.getUniformLocation("light.diffColor"),
          specColor: program_.getUniformLocation("light.specColor")
        }

        normalMapping_ = program_.getUniformLocation("normalMapping");
      });
  };



  this.setAttribPointers = function(mesh) {
    mesh.setAttribPointers(program_.program,
        mPosition_, null, texCoord_, mNormal_, mTangent_, mBitangent_);
  };



  this.setMaterialParam = function
      (id, diffColor, emissColor, specColor, shininess, opacity) {
    program_.start();
    program_.setUniformui(material_.id, id);
    program_.setUniformVector3f(material_.diffColor, diffColor);
    program_.setUniformVector3f(material_.emissColor, emissColor);
    program_.setUniformVector3f(material_.specColor, specColor);
    program_.setUniformf(material_.shininess, shininess);
    program_.setUniformf(material_.opacity, opacity);
    program_.stop();
  };



  this.setLightParam = function(eDirection, diffColor, specColor) {
    program_.start();
    program_.setUniformVector3f(light_.eDirection, eDirection);
    program_.setUniformVector3f(light_.diffColor, diffColor);
    program_.setUniformVector3f(light_.specColor, specColor);
    program_.stop();
  }



  this.setNormalMapping = function(normalMapping) {
    program_.start();
    program_.setUniformui(normalMapping_, normalMapping);
    program_.stop();
  }



  this.render = function(mesh, diffTexture, emissTexture, specNormTexture,
      modelViewMatrix, modelViewProjMatrix, normalMatrix) {
    program_.start();
    program_.setUniformMatrix4f(modelViewMatrix_, modelViewMatrix);
    program_.setUniformMatrix4f(modelViewProjMatrix_, modelViewProjMatrix);
    program_.setUniformMatrix4f(normalMatrix_, normalMatrix);

    let diffTextureUnit = 0;
    program_.setUniformi(diffTexSampler_, diffTextureUnit);
    diffTexture.startReading(diffTextureUnit);

    if (emissTexture) {
      let emissTextureUnit = 1;
      program_.setUniformi(emissTexSampler_, emissTextureUnit);
      emissTexture.startReading(emissTextureUnit);
    }

    if (specNormTexture) {
      let specNormTextureUnit = 2;
      program_.setUniformi(specNormTexSampler_, specNormTextureUnit);
      specNormTexture.startReading(specNormTextureUnit);
    }

    mesh.render(program_.program,
        mPosition_, null, texCoord_, mNormal_, mTangent_, mBitangent_);

    diffTexture.stopReading();
    if (emissTexture) emissTexture.stopReading();
    if (specNormTexture) specNormTexture.stopReading();

    program_.stop();
  };



  this.deleteProgram = function() {
    program_.deleteProgram();
  };



  const program_ = 
      new Program([gl], shaders.vertexShader, shaders.fragmentShader);
  let mPosition_, texCoord_, mNormal_, mTangent_, mBitangent_;
  let modelViewMatrix_, modelViewProjMatrix_, normalMatrix_;
  let diffTexSampler_, emissTexSampler_, specNormTexSampler_;
  let material_, light_;
  let normalMapping_;
}
