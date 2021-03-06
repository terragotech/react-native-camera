import React, { Component, PropTypes } from 'react';
import {
  DeviceEventEmitter, // android
  NativeAppEventEmitter, // ios
  NativeModules,
  Platform,
  StyleSheet,
  requireNativeComponent,
  View,
} from 'react-native';

const CameraManager = NativeModules.CameraManager || NativeModules.CameraModule;
const CAMERA_REF = 'camera';

function convertNativeProps(props) {
  const newProps = { ...props };
  if (typeof props.aspect === 'string') {
    newProps.aspect = Camera.constants.Aspect[props.aspect];
  }

  if (typeof props.flashMode === 'string') {
    newProps.flashMode = Camera.constants.FlashMode[props.flashMode];
  }

  if (typeof props.orientation === 'string') {
    newProps.orientation = Camera.constants.Orientation[props.orientation];
  }

  if (typeof props.torchMode === 'string') {
    newProps.torchMode = Camera.constants.TorchMode[props.torchMode];
  }

  if (typeof props.type === 'string') {
    newProps.type = Camera.constants.Type[props.type];
  }

  if (typeof props.captureQuality === 'string') {
    newProps.captureQuality = Camera.constants.CaptureQuality[props.captureQuality];
  }

  if (typeof props.captureMode === 'string') {
    newProps.captureMode = Camera.constants.CaptureMode[props.captureMode];
  }
  
  if (typeof props.captureTarget === 'string') {
    newProps.captureTarget = Camera.constants.CaptureTarget[props.captureTarget];
  }

  if (typeof props.zoom === 'string' || typeof props.zoom === 'number') {
      if (props.zoom >= 0 && props.zoom <= 100) {
        newProps.zoom = parseInt(props.zoom);
      }
  }

  // do not register barCodeTypes if no barcode listener
  if (typeof props.onBarCodeRead !== 'function') {
    newProps.barCodeTypes = [];
  }

  newProps.barcodeScannerEnabled = typeof props.onBarCodeRead === 'function'

  return newProps;
}

export default class Camera extends Component {

  static constants = {
    Aspect: CameraManager.Aspect,
    BarCodeType: CameraManager.BarCodeType,
    Type: CameraManager.Type,
    CaptureMode: CameraManager.CaptureMode,
    CaptureTarget: CameraManager.CaptureTarget,
    CaptureQuality: CameraManager.CaptureQuality,
    Orientation: CameraManager.Orientation,
    FlashMode: CameraManager.FlashMode,
    Zoom: CameraManager.Zoom,
    TorchMode: CameraManager.TorchMode
  };

  static propTypes = {
    ...View.propTypes,
    aspect: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    captureAudio: PropTypes.bool,
    captureMode: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    captureQuality: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    captureTarget: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    defaultOnFocusComponent: PropTypes.bool,
    flashMode: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    zoom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    keepAwake: PropTypes.bool,
    onBarCodeRead: PropTypes.func,
    barcodeScannerEnabled: PropTypes.bool,
    captureBarCodeImage: PropTypes.bool,
    onFocusChanged: PropTypes.func,
    onZoomChanged: PropTypes.func,
    mirrorImage: PropTypes.bool,
    barCodeTypes: PropTypes.array,
    orientation: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    playSoundOnCapture: PropTypes.bool,
    torchMode: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    type: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ])
  };

  static defaultProps = {
    aspect: CameraManager.Aspect.fill,
    type: CameraManager.Type.back,
    orientation: CameraManager.Orientation.auto,
    captureAudio: false,
    captureMode: CameraManager.CaptureMode.still,
    captureTarget: CameraManager.CaptureTarget.cameraRoll,
    captureQuality: CameraManager.CaptureQuality.high,
    defaultOnFocusComponent: true,
    flashMode: CameraManager.FlashMode.off,
    zoom: 0,
    playSoundOnCapture: true,
    torchMode: CameraManager.TorchMode.off,
    mirrorImage: false,
    barCodeTypes: Object.values(CameraManager.BarCodeType),
  };

  static checkDeviceAuthorizationStatus = CameraManager.checkDeviceAuthorizationStatus;
  static checkVideoAuthorizationStatus = CameraManager.checkVideoAuthorizationStatus;
  static checkAudioAuthorizationStatus = CameraManager.checkAudioAuthorizationStatus;

  setNativeProps(props) {
    this.refs[CAMERA_REF].setNativeProps(props);
  }

  constructor() {
    super();
    this.state = {
      isAuthorized: false,
      isRecording: false
    };
  }

  async componentWillMount() {
    this._addOnBarCodeReadListener()

    let { captureMode } = convertNativeProps({ captureMode: this.props.captureMode })
    let hasVideoAndAudio = this.props.captureAudio && captureMode === Camera.constants.CaptureMode.video
    let check = hasVideoAndAudio ? Camera.checkDeviceAuthorizationStatus : Camera.checkVideoAuthorizationStatus;

    if (check) {
      const isAuthorized = await check();
      this.setState({ isAuthorized });
    }
  }

  componentWillUnmount() {
    this._removeOnBarCodeReadListener()

    if (this.state.isRecording) {
      this.stopCapture();
    }
  }

  componentWillReceiveProps(newProps) {
    const { onBarCodeRead } = this.props
    if (onBarCodeRead !== newProps.onBarCodeRead) {
      this._addOnBarCodeReadListener(newProps)
    }
  }

  _addOnBarCodeReadListener(props) {
    const { onBarCodeRead } = props || this.props
    this._removeOnBarCodeReadListener()
    if (onBarCodeRead) {
      this.cameraBarCodeReadListener = Platform.select({
        ios: NativeAppEventEmitter.addListener('CameraBarCodeRead', this._onBarCodeRead),
        android: DeviceEventEmitter.addListener('CameraBarCodeReadAndroid',  this._onBarCodeRead)
      })
    }
  }
  _removeOnBarCodeReadListener() {
    const listener = this.cameraBarCodeReadListener
    if (listener) {
      listener.remove()
    }
  }

  render() {
    const style = [styles.base, this.props.style];
    const nativeProps = convertNativeProps(this.props);

    return <RCTCamera ref={CAMERA_REF} {...nativeProps} />;
  }

  _onBarCodeRead = (data) => {
    if (this.props.onBarCodeRead) {
      let image;
      this.props.onBarCodeRead({...data, image: {
        // using thenable instead of a Promise to create an image by demand, not immediately.
        then: (onsuccess, onfailure) => {
          if (!image) {
            if (CameraManager.getBarcodeImage) 
              image = CameraManager.getBarcodeImage && CameraManager.getBarcodeImage()
              if (!image) { // fallback to an old version of API
                image = this.capture({
                  mode: Camera.constants.CaptureMode.still,
                  target: Camera.constants.CaptureTarget.temp,
                  quality: Camera.constants.CaptureQuality.low,
                  playSoundOnCapture: false,
                });
              }
          }
          image.then(onsuccess, onfailure)
        },
      }})
      image = Promise.resolve();
    }
  };

  capture(options) {
    const props = convertNativeProps(this.props);
    options = {
      audio: props.captureAudio,
      barCodeTypes: props.barCodeTypes,
      mode: props.captureMode,
      playSoundOnCapture: props.playSoundOnCapture,
      target: props.captureTarget,
      quality: props.captureQuality,
      type: props.type,
      title: '',
      description: '',
      mirrorImage: props.mirrorImage,
      ...options
    };

    if (options.mode === Camera.constants.CaptureMode.video) {
      options.totalSeconds = (options.totalSeconds > -1 ? options.totalSeconds : -1);
      options.preferredTimeScale = options.preferredTimeScale || 30;
      this.setState({ isRecording: true });
    }

    return CameraManager.capture(options);
  }

  stopCapture() {
    if (this.state.isRecording) {
      this.setState({ isRecording: false });
      return CameraManager.stopCapture();
    }
    return Promise.resolve("Not Recording.");
  }

  getFOV() {
    return CameraManager.getFOV();
  }

  hasFlash() {
    if (Platform.OS === 'android') {
      const props = convertNativeProps(this.props);
      return CameraManager.hasFlash({
        type: props.type
      });
    }
    return CameraManager.hasFlash();
  }
  setZoom(zoomFactor) {
    if (Platform.OS === 'android') {
        const props = convertNativeProps(this.props);
          return CameraManager.setZoom({
            type: props.type,
            }, zoom);
      }
    return CameraManager.setZoom(zoomFactor);
  }
}

export const constants = Camera.constants;

const RCTCamera = requireNativeComponent('RCTCamera', Camera);

const styles = StyleSheet.create({
  base: {},
});
