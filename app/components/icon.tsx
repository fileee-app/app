// Lucide icons (ISC, assets/icons/LICENSE) as SVG assets, tinted with `tint-*` classes.
import { Image } from "nsh";
import check from "../assets/icons/check.svg";
import chevronLeft from "../assets/icons/chevron-left.svg";
import circleAlert from "../assets/icons/circle-alert.svg";
import cloudUpload from "../assets/icons/cloud-upload.svg";
import download from "../assets/icons/download.svg";
import ellipsis from "../assets/icons/ellipsis.svg";
import file from "../assets/icons/file.svg";
import fileArchive from "../assets/icons/file-archive.svg";
import fileAudio from "../assets/icons/file-audio.svg";
import fileImage from "../assets/icons/file-image.svg";
import fileText from "../assets/icons/file-text.svg";
import fileVideo from "../assets/icons/file-video.svg";
import folder from "../assets/icons/folder.svg";
import folderFill from "../assets/icons/folder-fill.svg";
import folderInput from "../assets/icons/folder-input.svg";
import folderPlus from "../assets/icons/folder-plus.svg";
import hardDrive from "../assets/icons/hard-drive.svg";
import house from "../assets/icons/house.svg";
import layoutGrid from "../assets/icons/layout-grid.svg";
import link from "../assets/icons/link.svg";
import list from "../assets/icons/list.svg";
import logOut from "../assets/icons/log-out.svg";
import menu from "../assets/icons/menu.svg";
import pencil from "../assets/icons/pencil.svg";
import plus from "../assets/icons/plus.svg";
import refreshCw from "../assets/icons/refresh-cw.svg";
import search from "../assets/icons/search.svg";
import settings from "../assets/icons/settings.svg";
import share2 from "../assets/icons/share-2.svg";
import square from "../assets/icons/square.svg";
import squareCheck from "../assets/icons/square-check.svg";
import star from "../assets/icons/star.svg";
import starFill from "../assets/icons/star-fill.svg";
import trash2 from "../assets/icons/trash-2.svg";
import upload from "../assets/icons/upload.svg";
import userRound from "../assets/icons/user-round.svg";
import usersRound from "../assets/icons/users-round.svg";
import x from "../assets/icons/x.svg";

const ICONS = {
  "check": check,
  "chevron-left": chevronLeft,
  "circle-alert": circleAlert,
  "cloud-upload": cloudUpload,
  "download": download,
  "ellipsis": ellipsis,
  "file": file,
  "file-archive": fileArchive,
  "file-audio": fileAudio,
  "file-image": fileImage,
  "file-text": fileText,
  "file-video": fileVideo,
  "folder": folder,
  "folder-fill": folderFill,
  "folder-input": folderInput,
  "folder-plus": folderPlus,
  "hard-drive": hardDrive,
  "house": house,
  "layout-grid": layoutGrid,
  "link": link,
  "list": list,
  "log-out": logOut,
  "menu": menu,
  "pencil": pencil,
  "plus": plus,
  "refresh-cw": refreshCw,
  "search": search,
  "settings": settings,
  "share-2": share2,
  "square": square,
  "square-check": squareCheck,
  "star": star,
  "star-fill": starFill,
  "trash-2": trash2,
  "upload": upload,
  "user-round": userRound,
  "users-round": usersRound,
  "x": x,
};

export type IconName = keyof typeof ICONS;

/** A one-color icon: size it and color it with classes (`size-4 tint-muted-foreground`). */
export const Icon = (props: { name: IconName; class?: string }) => (
  <Image src={ICONS[props.name]} accessibilityElementsHidden class={props.class ?? "size-4"} />
);
