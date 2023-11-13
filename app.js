//app.js
const http = require("http");
const multiparty = require("multiparty"); // 中间件，处理FormData对象的中间件
const path = require("path");
const fse = require("fs-extra"); //文件处理模块

const server = http.createServer();
const UPLOAD_DIR = path.resolve(__dirname, ".", "qiepian"); // 读取根目录，创建一个文件夹qiepian存放切片

server.on("request", async (req, res) => {
  // 处理跨域问题，允许所有的请求头和请求源
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const parsePostParams = (req) =>
    new Promise((resolve) => {
      let str = "";
      req.on("data", (data) => {
        str += data;
        console.log("str: ", str);
      });
      req.on("end", () => {
        resolve(JSON.parse(str));
      });
    });
  if (req.method === "OPTIONS") {
    // 配合 onProcess的
    res.status = 200;
    res.end();
    return;
  }
  // res.setHeader()
  if (req.url === "/upload") {
    //前端访问的地址正确
    const multipart = new multiparty.Form(); // 解析FormData对象
    multipart.parse(req, async (err, fields, files) => {
      if (err) {
        console.log("err: ", err);
        //解析失败
        return;
      }

      const [file] = files.file;
      const [fileName] = fields.fileName;
      const [chunkName] = fields.chunkName;

      const chunkDir = path.resolve(UPLOAD_DIR, `${fileName}-chunks`); //在qiepian文件夹创建一个新的文件夹，存放接收到的所有切片
      console.log("chunkDir: ", chunkDir);
      if (!fse.existsSync(chunkDir)) {
        //文件夹不存在，新建该文件夹
        await fse.mkdirs(chunkDir);
      }
      // 把切片移动进chunkDir
      await fse.move(file.path, `${chunkDir}/${chunkName}`);
      // 文件写入后 进行接口响应
      res.end(
        JSON.stringify({
          //向前端输出
          code: 0,
          message: "切片上传成功",
        })
      );
    });
  }
  if (req.url === "/merge") {
    const mergeFile = async (fileName, size) => {
      // 切片存放目录
      const slicePath = path.resolve(UPLOAD_DIR, `${fileName}-chunks`);

      const chunkPathList = (await fse.readdir(slicePath))
        .sort((a, b) => a.split("-")[1] - b.split("-")[1])
        .map((name) => path.resolve(slicePath, name));

      const pList = chunkPathList.map((chunkPath, index) => {
        return new Promise((resolve) => {
          const readStream = fse.createReadStream(chunkPath);
          const writeStream = fse.createWriteStream(
            path.resolve(UPLOAD_DIR, `${fileName}`),
            {
              start: index * size,
              end: (index + 1) * size,
            }
          );
          readStream.on("end", () => {
            fse.unlinkSync(chunkPath);
            resolve();
          });
          readStream.pipe(writeStream);
        });
      });
      return Promise.all(pList);
    };
    const { fileName, size } = await parsePostParams(req);
    mergeFile(fileName, size).then((mergeResList) => {
      res.end(
        JSON.stringify({
          code: "200",
          message: "文件合并成功",
        })
      );
    });
  }
  if (req.url === "/verify") {
    const { fileName } = await parsePostParams(req);
    console.log("fileName: ", fileName);
    const filePath = path.resolve(UPLOAD_DIR, fileName);
    if (fse.existsSync(filePath)) {
      res.end(
        JSON.stringify({
          hasFile: true,
        })
      );
    } else {
      let list = [];
      if (fse.existsSync(path.resolve(UPLOAD_DIR, `${fileName}-chunks`))) {
        list = await fse.readdir(
          path.resolve(UPLOAD_DIR, `${fileName}-chunks`)
        );
      }
      res.end(
        JSON.stringify({
          hasFile: false,
          list,
        })
      );
    }
  }
  const filePath = './ddd.html'
  if (req.url === "/download") {
    // res.setHeader("Content-Disposition", 'attachment; filename="list.txt"');
    // res.end("name:manyuemeiquqi");

    const range = req.headers["range"];
    console.log('range: ', range);
    const [start, end] = range.split("=")[1].split('-').map((item) => +item);
    console.log('start, end: ', start, end);
    res.statusCode = 206;
    fse.createReadStream(filePath, {
      start,
      end,
    }).pipe(res)

  }
  if (req.url === "/downLength") {
    const fileLength = fse.statSync(filePath).size;
    console.log('filePath: ', filePath);
    res.end(fileLength + "");
  }
});
server.listen(3000, () => {
  console.log("服务已启动");
});
