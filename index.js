const fs = require("fs");
const { PNG } = require("pngjs");
const { exit } = require("process");
const path = require("path");

function findPngFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir); // Read the directory

    for (const file of files) {
        const fullPath = path.join(dir, file); // Get the full path
        const stat = fs.statSync(fullPath); // Get file/directory information

        if (stat.isDirectory()) {
            // If it's a directory, recursively call the function
            findPngFiles(fullPath, fileList);
        } else if (file.endsWith(".png")) {
            // If it's a .png file, add it to the list
            fileList.push(fullPath);
        }
    }

    return fileList;
}

if (process.argv.some((arg) => arg == "--help" || arg == "-help" || arg == "help" || arg == "--h" || arg == "-h" || arg == "h")) {
    console.log("Alphafix help:");
    console.log("Choose an action, specify all the .png files (or use --folder), set the parameters, and run");
    console.log("(using - or -- before parameters are optional)");
    console.log("");
    console.log("Actions: (choose only 1)");
    console.log("--premultiply: Multiplies the pixel values by the alpha");
    console.log("--unpremultiply: Divides the pixel values by the alpha");
    console.log("--deletebackground: Removes the background from the image (all pixels with alpha 0 become black)");
    console.log("");
    console.log("Parameters:");
    console.log("--replace: replaces the asset/s with the modifications. Otherwise, a new file is created with the action at the end of the name (or a -1 if it already exists)");
    console.log("--folder: it'll take all .png files in the current directory and in the subfolders recursivelly");
    console.log("");
    console.log("Examples: ");
    console.log("         alphafix file.png -premultiply");
    console.log("         alphafix folder replace deletebackground");
    console.log("         alphafix file1.png file2.png unpremultiply");
    console.log("         alphafix --folder deletebackground --replace");
    exit(0);
}

let validArguments = 0;
process.argv.forEach((arg) => {
    if (
        arg == "--premultiply" ||
        arg == "-premultiply" ||
        arg == "premultiply" ||
        arg == "--unpremultiply" ||
        arg == "-unpremultiply" ||
        arg == "unpremultiply" ||
        arg == "--deletebackground" ||
        arg == "-deletebackground" ||
        arg == "deletebackground"
    ) {
        validArguments++;
    }
});

if (validArguments != 1) {
    console.error("You must specify one Action argument (only 1). Use -help for more assistance");
    exit(1);
}

const replace = process.argv.some((arg) => arg == "--replace" || arg == "-replace" || arg == "replace");
const folder = process.argv.some((arg) => arg == "--folder" || arg == "-folder" || arg == "folder");
const premultiply = process.argv.some((arg) => arg == "--premultiply" || arg == "-premultiply" || arg == "premultiply");
const unpremultiply = process.argv.some((arg) => arg == "--unpremultiply" || arg == "-unpremultiply" || arg == "unpremultiply");
const deletebackground = process.argv.some((arg) => arg == "--deletebackground" || arg == "-deletebackground" || arg == "deletebackground");
let filenameFinal = "";

if (!replace) {
    if (premultiply) {
        filenameFinal = "_premultiplied";
    } else if (unpremultiply) {
        filenameFinal = "_unpremultiplied";
    } else if (deletebackground) {
        filenameFinal = "_backgrounddeleted";
    }
}

let pngfilenames;

if (folder) {
    pngfilenames = findPngFiles(process.cwd());
    const cwdLength = process.cwd().length;
    pngfilenames = pngfilenames.map((pngfn) => pngfn.substring(cwdLength + 1, pngfn.length));
} else {
    pngfilenames = process.argv.filter((arg) => arg.endsWith(".png"));
}

if (pngfilenames.length == 0) {
    console.error(`It wasn't specified neither any .png image in parameters or --folder parameter`);
    exit(1);
}

for (const pngfs of pngfilenames) {
    fs.createReadStream(pngfs)
        .pipe(new PNG())
        .on("parsed", function () {
            const channels = this.data.length / (this.width * this.height);

            if (channels === 4) {
                let changed = false;
                for (let i = 0; i < this.width; i++) {
                    for (let j = 0; j < this.height; j++) {
                        // Read the value of a specific pixel (x, y)
                        const idx = (this.width * j + i) * 4; // Index of pixel in buffer

                        // Obtain values of RGB channels
                        const red = this.data[idx];
                        const green = this.data[idx + 1];
                        const blue = this.data[idx + 2];
                        const alpha = this.data[idx + 3];

                        if (premultiply) {
                            if (alpha != 255) {
                                this.data[idx] = Math.round((red * alpha) / 255);
                                this.data[idx + 1] = Math.round((green * alpha) / 255);
                                this.data[idx + 2] = Math.round((blue * alpha) / 255);
                                changed = true;
                            }
                        } else if (unpremultiply) {
                            if (alpha != 0) {
                                this.data[idx] = Math.round((red / alpha) * 255);
                                this.data[idx + 1] = Math.round((green / alpha) * 255);
                                this.data[idx + 2] = Math.round((blue / alpha) * 255);
                                changed = true;
                            }
                        } else if (deletebackground) {
                            if (alpha == 0) {
                                this.data[idx] = 0;
                                this.data[idx + 1] = 0;
                                this.data[idx + 2] = 0;
                                changed = true;
                            }
                        }
                    }
                }

                if (changed) {
                    const imageFilename = replace ? pngfs : pngfs.substring(0, pngfs.length - 4) + filenameFinal + ".png";
                    const exists = fs.existsSync(imageFilename);

                    this.pack().pipe(fs.createWriteStream(imageFilename));
                    console.log(`The image ${pngfs} was ${exists ? "processed" : "created"} successfully`);
                } else {
                    if (!replace) {
                        this.pack().pipe(fs.createWriteStream(pngfs.substring(0, pngfs.length - 4) + filenameFinal + ".png"));
                    }
                    console.log(`The image ${pngfs} was processed but no changes were made`);
                }
            } else {
                console.log(`The format of the image ${pngfs} must be RGBA to be processed`);
            }
        });
}
