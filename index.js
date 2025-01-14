const fs = require("fs");
const { PNG } = require("pngjs");
const { exit } = require("process");
const path = require("path");

if (process.argv.some((arg) => arg == "--help" || arg == "-help" || arg == "help" || arg == "--h" || arg == "-h" || arg == "h")) {
    console.log("Specify the .png files to read in the command line");
    console.log("Example: node index.js file.png -premultiply");
    console.log("--premultiply: Multiplies the pixel values by the alpha");
    console.log("--unpremultiply: Divides the pixel values by the alpha");
    console.log("--deletebackground: Removes the background from the image (all pixels with alpha 0 become black)");
    console.log("--replace: Replaces the asset with the relevant modifications. Otherwise, a new file is created with a 1 at the end of the name");
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
    console.error("You must specify one argument (only 1). Use -help for more assistance");
    exit(1);
}

const replace = process.argv.some((arg) => arg == "--replace" || arg == "-replace" || arg == "replace");
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

function generateUniqueFileName(filePath) {
    let extname = path.extname(filePath);
    let basename = path.basename(filePath, extname);
    let dir = path.dirname(filePath);

    let counter = 1;
    let newFilePath = filePath;

    // Verify if file's already existing, and modify the name if necessary
    while (fs.existsSync(newFilePath)) {
        newFilePath = path.join(dir, `${basename}-${counter}${extname}`);
        counter++;
    }

    return newFilePath;
}

const pngfilenames = process.argv.filter((arg) => arg.endsWith(".png"));

if (pngfilenames.length == 0) {
    console.error(`It wasn't specified any .png image in parameters`);
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
                    this.pack().pipe(fs.createWriteStream(replace ? pngfs : generateUniqueFileName(pngfs.substring(0, pngfs.length - 4) + filenameFinal + ".png")));
                    console.log(`The image ${pngfs} was processed successfully`);
                } else {
                    if (!replace) {
                        this.pack().pipe(fs.createWriteStream(generateUniqueFileName(pngfs.substring(0, pngfs.length - 4) + filenameFinal + ".png")));
                    }
                    console.log(`The image ${pngfs} was processed but no changes were made`);
                }
            } else {
                console.log(`The format of the image ${pngfs} must be RGBA to be processed`);
            }
        });
}
