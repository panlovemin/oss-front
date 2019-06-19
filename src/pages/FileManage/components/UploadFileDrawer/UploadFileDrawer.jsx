import React, { Component } from 'react';
import { Alert, Drawer, Form, Icon, Input, message, Radio, Upload } from 'antd';
import CryptoJS from 'crypto-js/crypto-js';
import { CreateObjectUrl } from '../../../../api/object';
import { getToken } from '../../../../util/auth';
import { getCurrentBucket } from '../../../../util/Bucket';
import './index.scss';


const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    s: { span: 5 },
    sm: { span: 4 },
  },
  wrapperCol: {
    xs: { span: 24 },
    s: { span: 19 },
    sm: { span: 20 },
  },
};

const ACLMessageTable = {
  EXTEND_BUCKET: <span style={{ fontSize: '12px' }}>继承 Bucket：单个文件的读写权限按 Bucket 的读写权限为准。</span>,
  PRIVATE: <span style={{ fontSize: '12px' }}>私有：对文件的所有访问操作需要进行身份验证。</span>,
  PUBLIC_READ: <span style={{ color: 'red', fontSize: '12px' }}>公共读：对文件写操作需要进行身份验证；可以对文件进行匿名读。</span>,
  PUBLIC: <span style={{ color: 'red', fontSize: '12px' }}>公共读写：所有人都可以对文件进行读写操作。</span>,
};

const Dragger = Upload.Dragger;
export default class UploadFileDrawer extends Component {
  static displayName = 'UploadFileDrawer';

  constructor(props) {
    super(props);
    const bucketInfoFromStore = getCurrentBucket();
    this.state = {
      bucketInfo: bucketInfoFromStore,
      currentFilePath: this.props.currentPath,
      hash: '',
      fileSize: 0,
      acl: 'EXTEND_BUCKET',
      aclMessage: ACLMessageTable.EXTEND_BUCKET,
      uploadPath: this.props.currentPath,
      uploadPathMessage: `oss://${bucketInfoFromStore.name + this.props.currentPath}`,
      radioSelect: this.props.currentPath,
      // 输入指定目录错误提示信息
      inputPathErrorMsg: '',
    };
  }

  uploadBtnOnchange = (info) => {
    if (info.file.status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    if (info.file.status === 'done') {
      message.success(`${info.file.name} ${info.file.response.data && info.file.response.data}`);
      this.props.onSuccess();
      this.props.onClose();
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败，${info.file.response.msg}`);
    }
  };

  beforeUploadHook = async (file) => {
    console.log(file);
    // 检查 目录
    const { uploadPath } = this.state;
    if (!uploadPath || !uploadPath.trim()) {
      await this.setState({
        inputPathErrorMsg: <span style={styles.errorMsg}>指定目录不能为空</span>,
      });
      message.warning('指定目录不能为空');
      return Promise.reject('指定目录不能为空');
    }
    try {
      const reader = new FileReader();
      await reader.readAsArrayBuffer(file);
      reader.onload = async (evt) => {
        if (evt.target.readyState === FileReader.DONE) {
          const wordArray = CryptoJS.lib.WordArray.create(reader.result);
          const hash = CryptoJS.SHA256(wordArray).toString().toUpperCase();
          await this.setState({
            hash,
            fileSize: file.size,
          });
        }
        return Promise.resolve();
      };
    } catch (e) {
      return Promise.reject(e);
    }
  };

  aclChange = (e) => {
    e.preventDefault();
    this.setState({
      acl: e.target.value,
      aclMessage: ACLMessageTable[e.target.value],
    });
  };

  currentFilePathChange = (e) => {
    e.preventDefault();
    const { uploadPath, uploadPathMessage, bucketInfo, currentFilePath, inputPathErrorMsg } = this.state;
    let msg = uploadPathMessage;
    let path = uploadPath;
    let inputErrorMsg = inputPathErrorMsg;
    if (e.target.value !== currentFilePath) {
      path = '';
      msg = (
        <div className="upload-help-info">
          <div className="oss-intl-lines">
            <p>目录命名规范：</p>
            <ol>
              <li>不允许使用表情符，请使用符合要求的 UTF-8 字符</li>
              <li>
                <code>/</code>
                用于分割路径，可快速创建子目录，但不要以
                <code>/</code>
                或
                <code>\</code>
                打头，不要出现连续的
                <code>/</code>
              </li>
              <li>
                不允许出现名为
                <code>..</code>
                的子目录
              </li>
              <li>总长度控制在 1-254 个字符</li>
            </ol>
          </div>
        </div>
      );
    } else {
      path = currentFilePath;
      msg = `oss://${bucketInfo.name}/`;
      inputErrorMsg = '';
    }
    this.setState({
      radioSelect: e.target.value,
      uploadPathMessage: msg,
      uploadPath: path,
      inputPathErrorMsg: inputErrorMsg,
    });
  };

  uploadPathInputChange = (e) => {
    e.preventDefault();
    const value = e.target.value;
    const errorMsg = checkInput(value);
    this.setState({
      uploadPath: value,
      inputPathErrorMsg: errorMsg,
    });
  };

  render() {
    const { bucketInfo, currentFilePath, radioSelect, uploadPath, hash, fileSize, acl, aclMessage, uploadPathMessage, inputPathErrorMsg } = this.state;
    return (
      <Drawer
        width={640}
        placement="right"
        closable
        maskClosable={false}
        onClose={this.props.onClose}
        visible={this.props.visible}
        className="oss-drawer"
        title="上传文件"
      >
        <Form {...formItemLayout}>
          <Form.Item
            label="上传到"
            validateStatus="success"
            help={uploadPathMessage}
          >
            <Radio.Group value={radioSelect} onChange={this.currentFilePathChange}>
              <Radio.Button value={currentFilePath}>当前目录</Radio.Button>
              <Radio.Button value="USE_CUSTOM">指定目录</Radio.Button>
            </Radio.Group>
            {
              radioSelect !== currentFilePath ? (
                <Input placeholder="根目录" value={uploadPath} suffix={`${uploadPath.length}/254`} onChange={this.uploadPathInputChange} />
              ) : null
            }
            {
              inputPathErrorMsg ? (
                <div style={{ lineHeight: '18px' }}>
                  {inputPathErrorMsg}
                </div>
              ) : null
            }
          </Form.Item>

          <Form.Item
            label="读写权限"
            validateStatus="success"
            help={aclMessage}
          >
            <Radio.Group value={acl} onChange={this.aclChange}>
              <Radio.Button value="EXTEND_BUCKET">继承 Bucket</Radio.Button>
              <Radio.Button value="PRIVATE">私有</Radio.Button>
              <Radio.Button value="PUBLIC_READ">公共读</Radio.Button>
              <Radio.Button value="PUBLIC">公共读写</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label="上传文件"
            help={uploadHelpMessage}
          >
            <Dragger
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,xls,.xlsx,.ppt,.pptx,.md,.xml,.json"
              name="file"
              action={CreateObjectUrl}
              multiple
              headers={{
                authorization: getToken(),
                Digest: hash,
                fileSize,
              }}
              data={{
                bucketId: bucketInfo.id,
                filePath: uploadPath,
                acl,
              }}
              beforeUpload={this.beforeUploadHook}
              onChange={this.uploadBtnOnchange}
            >
              <p className="ant-upload-drag-icon">
                <Icon type="inbox" />
              </p>
              <p className="ant-upload-text">单击或拖拽上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Drawer>
    );
  }
}

const checkInput = function (value) {
  let errorMsg = '';
  if (value.startsWith('//')) {
    errorMsg = (
      <span style={styles.errorMsg}>
          目录路径不允许出现连续的「/」
      </span>
    );
  } else if (value.startsWith('/') || value.endsWith('\\')) {
    errorMsg = (
      <span style={styles.errorMsg}>
          文件名不能以
        <code>/</code>
          或
        <code>\</code>
          开头和结尾。
      </span>
    );
  } else if (value.length > 254) {
    errorMsg = (
      <span>
          目录长度不超过 254 个字符
      </span>
    );
  } else if (value.indexOf('..') !== -1) {
    errorMsg = (
      <span style={styles.errorMsg}>
          不允许出现名为
        <code>..</code>
          的子目录
      </span>
    );
  } else {
    errorMsg = '';
  }
  return errorMsg;
};

const styles = {
  errorMsg: {
    color: 'red',
    fontSize: '12px',
  },
};

const uploadHelpMessage = (
  <div className="upload-help-info">
    <div className="oss-intl-lines">
      <p>文件的命名规范如下：</p>
      <ol>
        <li>使用 UTF-8 编码；</li>
        <li>区分大小写；</li>
        <li>长度必须在 1-1023 字节之间；</li>
        <li>
          不能以
          <code>/</code>
          或者
          <code>\</code>
          字符开头。
        </li>
      </ol>
    </div>
    <Alert message="注意，Bucket 下若存在同名文件，将被新上传的文件覆盖。" type="warning" showIcon />
  </div>
);