/* CAP DXF export — a drawing that AutoCAD opens and CAP Worksheet lists parts from.
   Format decoded from a CAP drawing (see cap/NOTES.md): every part is an INSERT of a block named P_<style number> carrying the CAP
   attributes (CAPPN style number, CAPPD description, CAPMG maker, CAPMC category, CAPPL list price, CAPTG visible tag, CAPQT, CAPDH...);
   panels are config blocks with the frame and the skins nested inside. Written as AutoCAD 2000 (AC1015), the format CAP accepts
   (R12 is refused); the file skeleton (header variables, classes, standard tables and objects) is the one AutoCAD writes.
   Every INSERT comes from a specification line: CAPPN is the style number on the Specification tab and the number of inserts of a
   style equals its specified quantity. Nothing is renamed or added for CAP. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : root.ANSWER;
  // DXF R2000 skeleton as AutoCAD writes it (header variables, classes, the standard tables and objects), from a reference drawing; entities are generated
  const CAPDXF_TPL = {
    header: '9\n$ACADMAINTVER\n70\n6\n9\n$DWGCODEPAGE\n3\nANSI_1252\n9\n$INSBASE\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$ORTHOMODE\n70\n0\n9\n$REGENMODE\n70\n1\n9\n$FILLMODE\n70\n1\n9\n$QTEXTMODE\n70\n0\n9\n$MIRRTEXT\n70\n1\n9\n$LTSCALE\n40\n1.0\n9\n$ATTMODE\n70\n1\n9\n$TEXTSIZE\n40\n2.5\n9\n$TRACEWID\n40\n1.0\n9\n$TEXTSTYLE\n7\nStandard\n9\n$CLAYER\n8\n0\n9\n$CELTYPE\n6\nByLayer\n9\n$CECOLOR\n62\n256\n9\n$CELTSCALE\n40\n1.0\n9\n$DISPSILH\n70\n0\n9\n$DIMSCALE\n40\n1.0\n9\n$DIMASZ\n40\n2.5\n9\n$DIMEXO\n40\n0.625\n9\n$DIMDLI\n40\n3.75\n9\n$DIMRND\n40\n0.0\n9\n$DIMDLE\n40\n0.0\n9\n$DIMEXE\n40\n1.25\n9\n$DIMTP\n40\n0.0\n9\n$DIMTM\n40\n0.0\n9\n$DIMTXT\n40\n2.5\n9\n$DIMCEN\n40\n2.5\n9\n$DIMTSZ\n40\n0.0\n9\n$DIMTOL\n70\n0\n9\n$DIMLIM\n70\n0\n9\n$DIMTIH\n70\n0\n9\n$DIMTOH\n70\n0\n9\n$DIMSE1\n70\n0\n9\n$DIMSE2\n70\n0\n9\n$DIMTAD\n70\n1\n9\n$DIMZIN\n70\n8\n9\n$DIMBLK\n1\n\n9\n$DIMASO\n70\n1\n9\n$DIMSHO\n70\n1\n9\n$DIMPOST\n1\n\n9\n$DIMAPOST\n1\n\n9\n$DIMALT\n70\n0\n9\n$DIMALTD\n70\n3\n9\n$DIMALTF\n40\n0.03937007874\n9\n$DIMLFAC\n40\n1.0\n9\n$DIMTOFL\n70\n1\n9\n$DIMTVP\n40\n0.0\n9\n$DIMTIX\n70\n0\n9\n$DIMSOXD\n70\n0\n9\n$DIMSAH\n70\n0\n9\n$DIMBLK1\n1\n\n9\n$DIMBLK2\n1\n\n9\n$DIMSTYLE\n2\nISO-25\n9\n$DIMCLRD\n70\n0\n9\n$DIMCLRE\n70\n0\n9\n$DIMCLRT\n70\n0\n9\n$DIMTFAC\n40\n1.0\n9\n$DIMGAP\n40\n0.625\n9\n$DIMJUST\n70\n0\n9\n$DIMSD1\n70\n0\n9\n$DIMSD2\n70\n0\n9\n$DIMTOLJ\n70\n0\n9\n$DIMTZIN\n70\n8\n9\n$DIMALTZ\n70\n0\n9\n$DIMALTTZ\n70\n0\n9\n$DIMUPT\n70\n0\n9\n$DIMDEC\n70\n2\n9\n$DIMTDEC\n70\n2\n9\n$DIMALTU\n70\n2\n9\n$DIMALTTD\n70\n3\n9\n$DIMTXSTY\n7\nStandard\n9\n$DIMAUNIT\n70\n0\n9\n$DIMADEC\n70\n0\n9\n$DIMALTRND\n40\n0.0\n9\n$DIMAZIN\n70\n0\n9\n$DIMDSEP\n70\n44\n9\n$DIMATFIT\n70\n3\n9\n$DIMFRAC\n70\n0\n9\n$DIMLDRBLK\n1\n\n9\n$DIMLUNIT\n70\n2\n9\n$DIMLWD\n70\n-2\n9\n$DIMLWE\n70\n-2\n9\n$DIMTMOVE\n70\n0\n9\n$LUNITS\n70\n2\n9\n$LUPREC\n70\n4\n9\n$SKETCHINC\n40\n1.0\n9\n$FILLETRAD\n40\n10.0\n9\n$AUNITS\n70\n0\n9\n$AUPREC\n70\n2\n9\n$MENU\n1\n.\n9\n$ELEVATION\n40\n0.0\n9\n$PELEVATION\n40\n0.0\n9\n$THICKNESS\n40\n0.0\n9\n$LIMCHECK\n70\n0\n9\n$CHAMFERA\n40\n0.0\n9\n$CHAMFERB\n40\n0.0\n9\n$CHAMFERC\n40\n0.0\n9\n$CHAMFERD\n40\n0.0\n9\n$SKPOLY\n70\n0\n9\n$TDINDWG\n40\n0.0\n9\n$TDUSRTIMER\n40\n0.0\n9\n$USRTIMER\n70\n1\n9\n$ANGBASE\n50\n0.0\n9\n$ANGDIR\n70\n0\n9\n$PDMODE\n70\n0\n9\n$PDSIZE\n40\n0.0\n9\n$PLINEWID\n40\n0.0\n9\n$SPLFRAME\n70\n0\n9\n$SPLINETYPE\n70\n6\n9\n$SPLINESEGS\n70\n8\n9\n$SURFTAB1\n70\n6\n9\n$SURFTAB2\n70\n6\n9\n$SURFTYPE\n70\n6\n9\n$SURFU\n70\n6\n9\n$SURFV\n70\n6\n9\n$UCSBASE\n2\n\n9\n$UCSNAME\n2\n\n9\n$UCSORG\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$UCSXDIR\n10\n1.0\n20\n0.0\n30\n0.0\n9\n$UCSYDIR\n10\n0.0\n20\n1.0\n30\n0.0\n9\n$UCSORTHOREF\n2\n\n9\n$UCSORTHOVIEW\n70\n0\n9\n$UCSORGTOP\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$UCSORGBOTTOM\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$UCSORGLEFT\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$UCSORGRIGHT\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$UCSORGFRONT\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$UCSORGBACK\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSBASE\n2\n\n9\n$PUCSNAME\n2\n\n9\n$PUCSORG\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSXDIR\n10\n1.0\n20\n0.0\n30\n0.0\n9\n$PUCSYDIR\n10\n0.0\n20\n1.0\n30\n0.0\n9\n$PUCSORTHOREF\n2\n\n9\n$PUCSORTHOVIEW\n70\n0\n9\n$PUCSORGTOP\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSORGBOTTOM\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSORGLEFT\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSORGRIGHT\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSORGFRONT\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PUCSORGBACK\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$USERI1\n70\n0\n9\n$USERI2\n70\n0\n9\n$USERI3\n70\n0\n9\n$USERI4\n70\n0\n9\n$USERI5\n70\n0\n9\n$USERR1\n40\n0.0\n9\n$USERR2\n40\n0.0\n9\n$USERR3\n40\n0.0\n9\n$USERR4\n40\n0.0\n9\n$USERR5\n40\n0.0\n9\n$WORLDVIEW\n70\n1\n9\n$SHADEDGE\n70\n3\n9\n$SHADEDIF\n70\n70\n9\n$TILEMODE\n70\n1\n9\n$MAXACTVP\n70\n64\n9\n$PINSBASE\n10\n0.0\n20\n0.0\n30\n0.0\n9\n$PLIMCHECK\n70\n0\n9\n$PEXTMIN\n10\n1e+20\n20\n1e+20\n30\n1e+20\n9\n$PEXTMAX\n10\n-1e+20\n20\n-1e+20\n30\n-1e+20\n9\n$PLIMMIN\n10\n0.0\n20\n0.0\n9\n$PLIMMAX\n10\n420.0\n20\n297.0\n9\n$UNITMODE\n70\n0\n9\n$VISRETAIN\n70\n1\n9\n$PLINEGEN\n70\n0\n9\n$PSLTSCALE\n70\n1\n9\n$TREEDEPTH\n70\n3020\n9\n$CMLSTYLE\n2\nStandard\n9\n$CMLJUST\n70\n0\n9\n$CMLSCALE\n40\n20.0\n9\n$PROXYGRAPHICS\n70\n1\n9\n$MEASUREMENT\n70\n0\n9\n$CELWEIGHT\n370\n-1\n9\n$ENDCAPS\n280\n0\n9\n$JOINSTYLE\n280\n0\n9\n$LWDISPLAY\n290\n0\n9\n$INSUNITS\n70\n1\n9\n$HYPERLINKBASE\n1\n\n9\n$STYLESHEET\n1\n\n9\n$XEDIT\n290\n1\n9\n$CEPSNTYPE\n380\n0\n9\n$PSTYLEMODE\n290\n1\n9\n$EXTNAMES\n290\n1\n9\n$PSVPSCALE\n40\n0.0\n9\n$OLESTARTUP\n290\n0',
    classes: '0\nSECTION\n2\nCLASSES\n0\nCLASS\n1\nACDBDICTIONARYWDFLT\n2\nAcDbDictionaryWithDefault\n3\nObjectDBX Classes\n90\n0\n280\n0\n281\n0\n0\nCLASS\n1\nSUN\n2\nAcDbSun\n3\nSCENEOE\n90\n1153\n280\n0\n281\n0\n0\nCLASS\n1\nVISUALSTYLE\n2\nAcDbVisualStyle\n3\nObjectDBX Classes\n90\n4095\n280\n0\n281\n0\n0\nCLASS\n1\nMATERIAL\n2\nAcDbMaterial\n3\nObjectDBX Classes\n90\n1153\n280\n0\n281\n0\n0\nCLASS\n1\nSCALE\n2\nAcDbScale\n3\nObjectDBX Classes\n90\n1153\n280\n0\n281\n0\n0\nCLASS\n1\nTABLESTYLE\n2\nAcDbTableStyle\n3\nObjectDBX Classes\n90\n4095\n280\n0\n281\n0\n0\nCLASS\n1\nMLEADERSTYLE\n2\nAcDbMLeaderStyle\n3\nACDB_MLEADERSTYLE_CLASS\n90\n4095\n280\n0\n281\n0\n0\nCLASS\n1\nDICTIONARYVAR\n2\nAcDbDictionaryVar\n3\nObjectDBX Classes\n90\n0\n280\n0\n281\n0\n0\nCLASS\n1\nCELLSTYLEMAP\n2\nAcDbCellStyleMap\n3\nObjectDBX Classes\n90\n1152\n280\n0\n281\n0\n0\nCLASS\n1\nMENTALRAYRENDERSETTINGS\n2\nAcDbMentalRayRenderSettings\n3\nSCENEOE\n90\n1024\n280\n0\n281\n0\n0\nCLASS\n1\nACDBDETAILVIEWSTYLE\n2\nAcDbDetailViewStyle\n3\nObjectDBX Classes\n90\n1025\n280\n0\n281\n0\n0\nCLASS\n1\nACDBSECTIONVIEWSTYLE\n2\nAcDbSectionViewStyle\n3\nObjectDBX Classes\n90\n1025\n280\n0\n281\n0\n0\nCLASS\n1\nRASTERVARIABLES\n2\nAcDbRasterVariables\n3\nISM\n90\n0\n280\n0\n281\n0\n0\nCLASS\n1\nACDBPLACEHOLDER\n2\nAcDbPlaceHolder\n3\nObjectDBX Classes\n90\n0\n280\n0\n281\n0\n0\nCLASS\n1\nLAYOUT\n2\nAcDbLayout\n3\nObjectDBX Classes\n90\n0\n280\n0\n281\n0\n0\nENDSEC',
    vport: '0\nTABLE\n2\nVPORT\n5\n8\n330\n0\n100\nAcDbSymbolTable\n70\n1\n0\nVPORT\n5\n23\n330\n8\n100\nAcDbSymbolTableRecord\n100\nAcDbViewportTableRecord\n2\n*Active\n70\n0\n10\n0.0\n20\n0.0\n11\n1.0\n21\n1.0\n12\n0.0\n22\n0.0\n13\n0.0\n23\n0.0\n14\n0.5\n24\n0.5\n15\n0.5\n25\n0.5\n16\n0.0\n26\n0.0\n36\n1.0\n17\n0.0\n27\n0.0\n37\n0.0\n40\n1000.0\n41\n1.34\n42\n50.0\n43\n0.0\n44\n0.0\n50\n0.0\n51\n0.0\n71\n0\n72\n1000\n73\n1\n74\n3\n75\n0\n76\n0\n77\n0\n78\n0\n281\n0\n65\n0\n146\n0.0\n0\nENDTAB',
    ltype: '0\nTABLE\n2\nLTYPE\n5\n2\n330\n0\n100\nAcDbSymbolTable\n70\n3\n0\nLTYPE\n5\n24\n330\n2\n100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n2\nByBlock\n70\n0\n3\n\n72\n65\n73\n0\n40\n0.0\n0\nLTYPE\n5\n25\n330\n2\n100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n2\nByLayer\n70\n0\n3\n\n72\n65\n73\n0\n40\n0.0\n0\nLTYPE\n5\n26\n330\n2\n100\nAcDbSymbolTableRecord\n100\nAcDbLinetypeTableRecord\n2\nContinuous\n70\n0\n3\n\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB',
    style: '0\nTABLE\n2\nSTYLE\n5\n5\n330\n0\n100\nAcDbSymbolTable\n70\n2\n0\nSTYLE\n5\n29\n330\n5\n100\nAcDbSymbolTableRecord\n100\nAcDbTextStyleTableRecord\n2\nStandard\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n0\nSTYLE\n5\n30\n330\n5\n100\nAcDbSymbolTableRecord\n100\nAcDbTextStyleTableRecord\n2\nMONOTXT\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n2.5\n3\nMONOTXT.SHX\n4\n\n0\nENDTAB',
    view: '0\nTABLE\n2\nVIEW\n5\n7\n330\n0\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB',
    ucs: '0\nTABLE\n2\nUCS\n5\n6\n330\n0\n100\nAcDbSymbolTable\n70\n0\n0\nENDTAB',
    appid: '0\nTABLE\n2\nAPPID\n5\n3\n330\n0\n100\nAcDbSymbolTable\n70\n2\n0\nAPPID\n5\n2A\n330\n3\n100\nAcDbSymbolTableRecord\n100\nAcDbRegAppTableRecord\n2\nACAD\n70\n0\n0\nAPPID\n5\n42\n330\n3\n100\nAcDbSymbolTableRecord\n100\nAcDbRegAppTableRecord\n2\nHATCHBACKGROUNDCOLOR\n70\n0\n0\nENDTAB',
    dimstyle: '0\nTABLE\n2\nDIMSTYLE\n5\n4\n330\n0\n100\nAcDbSymbolTable\n70\n1\n100\nAcDbDimStyleTable\n0\nDIMSTYLE\n105\n2B\n330\n4\n100\nAcDbSymbolTableRecord\n100\nAcDbDimStyleTableRecord\n2\nStandard\n70\n0\n3\n\n4\n\n40\n1.0\n41\n2.5\n42\n0.625\n43\n3.75\n44\n1.25\n45\n0.0\n46\n0.0\n47\n0.0\n48\n0.0\n140\n2.5\n141\n2.5\n142\n0.0\n143\n0.03937007874\n144\n1.0\n145\n0.0\n146\n1.0\n147\n0.625\n148\n0.0\n71\n0\n72\n0\n73\n0\n74\n0\n75\n0\n76\n0\n77\n1\n78\n8\n79\n3\n170\n0\n171\n3\n172\n1\n173\n0\n174\n0\n175\n0\n176\n0\n177\n0\n178\n0\n179\n2\n271\n2\n272\n2\n273\n2\n274\n3\n275\n0\n276\n0\n277\n2\n278\n44\n279\n0\n280\n0\n281\n0\n282\n0\n283\n0\n284\n8\n285\n0\n286\n0\n288\n0\n289\n3\n371\n-2\n372\n-2\n0\nENDTAB',
    objects: '0\nSECTION\n2\nOBJECTS\n0\nDICTIONARY\n5\nA\n330\n0\n100\nAcDbDictionary\n281\n1\n3\nACAD_COLOR\n350\nB\n3\nACAD_GROUP\n350\nC\n3\nACAD_LAYOUT\n350\nD\n3\nACAD_MATERIAL\n350\nE\n3\nACAD_MLEADERSTYLE\n350\nF\n3\nACAD_MLINESTYLE\n350\n10\n3\nACAD_PLOTSETTINGS\n350\n11\n3\nACAD_PLOTSTYLENAME\n350\n12\n3\nACAD_SCALELIST\n350\n14\n3\nACAD_TABLESTYLE\n350\n15\n3\nACAD_VISUALSTYLE\n350\n16\n0\nDICTIONARY\n5\nB\n330\nA\n100\nAcDbDictionary\n281\n1\n0\nDICTIONARY\n5\nC\n330\nA\n100\nAcDbDictionary\n281\n1\n0\nDICTIONARY\n5\nD\n330\nA\n100\nAcDbDictionary\n281\n1\n3\nModel\n350\n1A\n3\nLayout1\n350\n1E\n0\nDICTIONARY\n5\nE\n330\nA\n100\nAcDbDictionary\n281\n1\n3\nByBlock\n350\n1F\n3\nByLayer\n350\n20\n3\nGlobal\n350\n21\n0\nDICTIONARY\n5\nF\n330\nA\n100\nAcDbDictionary\n281\n1\n3\nStandard\n350\n2C\n0\nDICTIONARY\n5\n10\n330\nA\n100\nAcDbDictionary\n281\n1\n3\nStandard\n350\n22\n0\nDICTIONARY\n5\n11\n330\nA\n100\nAcDbDictionary\n281\n1\n0\nACDBDICTIONARYWDFLT\n5\n12\n330\nA\n100\nAcDbDictionary\n281\n1\n3\nNormal\n350\n13\n100\nAcDbDictionaryWithDefault\n340\n13\n0\nACDBPLACEHOLDER\n5\n13\n330\n12\n0\nDICTIONARY\n5\n14\n330\nA\n100\nAcDbDictionary\n281\n1\n0\nDICTIONARY\n5\n15\n330\nA\n100\nAcDbDictionary\n281\n1\n0\nDICTIONARY\n5\n16\n330\nA\n100\nAcDbDictionary\n281\n1\n0\nLAYOUT\n5\n1A\n330\nD\n100\nAcDbPlotSettings\n1\n\n4\nA3\n6\n\n40\n7.5\n41\n20.0\n42\n7.5\n43\n20.0\n44\n420.0\n45\n297.0\n46\n0.0\n47\n0.0\n48\n0.0\n49\n0.0\n140\n0.0\n141\n0.0\n142\n1.0\n143\n1.0\n70\n1024\n72\n1\n73\n0\n74\n5\n7\n\n75\n16\n76\n0\n77\n2\n78\n300\n147\n1.0\n148\n0.0\n149\n0.0\n100\nAcDbLayout\n1\nModel\n70\n1\n71\n0\n10\n0.0\n20\n0.0\n11\n420.0\n21\n297.0\n12\n0.0\n22\n0.0\n32\n0.0\n14\n1e+20\n24\n1e+20\n34\n1e+20\n15\n-1e+20\n25\n-1e+20\n35\n-1e+20\n146\n0.0\n13\n0.0\n23\n0.0\n33\n0.0\n16\n1.0\n26\n0.0\n36\n0.0\n17\n0.0\n27\n1.0\n37\n0.0\n76\n1\n330\n17\n0\nLAYOUT\n5\n1E\n330\nD\n100\nAcDbPlotSettings\n1\n\n4\nA3\n6\n\n40\n7.5\n41\n20.0\n42\n7.5\n43\n20.0\n44\n420.0\n45\n297.0\n46\n0.0\n47\n0.0\n48\n0.0\n49\n0.0\n140\n0.0\n141\n0.0\n142\n1.0\n143\n1.0\n70\n0\n72\n1\n73\n0\n74\n5\n7\n\n75\n16\n76\n0\n77\n2\n78\n300\n147\n1.0\n148\n0.0\n149\n0.0\n100\nAcDbLayout\n1\nLayout1\n70\n1\n71\n1\n10\n0.0\n20\n0.0\n11\n420.0\n21\n297.0\n12\n0.0\n22\n0.0\n32\n0.0\n14\n1e+20\n24\n1e+20\n34\n1e+20\n15\n-1e+20\n25\n-1e+20\n35\n-1e+20\n146\n0.0\n13\n0.0\n23\n0.0\n33\n0.0\n16\n1.0\n26\n0.0\n36\n0.0\n17\n0.0\n27\n1.0\n37\n0.0\n76\n1\n330\n1B\n0\nMATERIAL\n5\n1F\n102\n{ACAD_REACTORS\n330\nE\n102\n}\n330\nE\n100\nAcDbMaterial\n1\nByBlock\n2\n\n70\n0\n40\n1.0\n71\n1\n41\n1.0\n91\n-1023410177\n42\n1.0\n72\n1\n3\n\n73\n1\n74\n1\n75\n1\n44\n0.5\n73\n0\n45\n1.0\n46\n1.0\n77\n1\n4\n\n78\n1\n79\n1\n170\n1\n48\n1.0\n171\n1\n6\n\n172\n1\n173\n1\n174\n1\n140\n1.0\n141\n1.0\n175\n1\n7\n\n176\n1\n177\n1\n178\n1\n143\n1.0\n179\n1\n8\n\n270\n1\n271\n1\n272\n1\n145\n1.0\n146\n1.0\n273\n1\n9\n\n274\n1\n275\n1\n276\n1\n42\n1.0\n72\n1\n3\n\n73\n1\n74\n1\n75\n1\n94\n63\n0\nMATERIAL\n5\n20\n102\n{ACAD_REACTORS\n330\nE\n102\n}\n330\nE\n100\nAcDbMaterial\n1\nByLayer\n2\n\n70\n0\n40\n1.0\n71\n1\n41\n1.0\n91\n-1023410177\n42\n1.0\n72\n1\n3\n\n73\n1\n74\n1\n75\n1\n44\n0.5\n73\n0\n45\n1.0\n46\n1.0\n77\n1\n4\n\n78\n1\n79\n1\n170\n1\n48\n1.0\n171\n1\n6\n\n172\n1\n173\n1\n174\n1\n140\n1.0\n141\n1.0\n175\n1\n7\n\n176\n1\n177\n1\n178\n1\n143\n1.0\n179\n1\n8\n\n270\n1\n271\n1\n272\n1\n145\n1.0\n146\n1.0\n273\n1\n9\n\n274\n1\n275\n1\n276\n1\n42\n1.0\n72\n1\n3\n\n73\n1\n74\n1\n75\n1\n94\n63\n0\nMATERIAL\n5\n21\n102\n{ACAD_REACTORS\n330\nE\n102\n}\n330\nE\n100\nAcDbMaterial\n1\nGlobal\n2\n\n70\n0\n40\n1.0\n71\n1\n41\n1.0\n91\n-1023410177\n42\n1.0\n72\n1\n3\n\n73\n1\n74\n1\n75\n1\n44\n0.5\n73\n0\n45\n1.0\n46\n1.0\n77\n1\n4\n\n78\n1\n79\n1\n170\n1\n48\n1.0\n171\n1\n6\n\n172\n1\n173\n1\n174\n1\n140\n1.0\n141\n1.0\n175\n1\n7\n\n176\n1\n177\n1\n178\n1\n143\n1.0\n179\n1\n8\n\n270\n1\n271\n1\n272\n1\n145\n1.0\n146\n1.0\n273\n1\n9\n\n274\n1\n275\n1\n276\n1\n42\n1.0\n72\n1\n3\n\n73\n1\n74\n1\n75\n1\n94\n63\n0\nMLINESTYLE\n5\n22\n102\n{ACAD_REACTORS\n330\n10\n102\n}\n330\n10\n100\nAcDbMlineStyle\n2\nStandard\n70\n0\n3\n\n62\n256\n51\n90.0\n52\n90.0\n71\n2\n49\n0.5\n62\n256\n6\nBYLAYER\n49\n-0.5\n62\n256\n6\nBYLAYER\n0\nMLEADERSTYLE\n5\n2C\n102\n{ACAD_REACTORS\n330\nF\n102\n}\n330\nF\n100\nAcDbMLeaderStyle\n179\n2\n170\n2\n171\n1\n172\n0\n90\n2\n40\n0.0\n41\n0.0\n173\n1\n91\n-1056964608\n92\n-2\n290\n1\n42\n2.0\n291\n1\n43\n8.0\n3\nStandard\n44\n4.0\n300\n\n342\n29\n174\n1\n175\n1\n176\n0\n178\n1\n93\n-1056964608\n45\n4.0\n292\n0\n297\n0\n46\n4.0\n94\n-1056964608\n47\n1.0\n49\n1.0\n140\n1.0\n294\n1\n141\n0.0\n177\n0\n142\n1.0\n295\n0\n296\n0\n143\n3.75\n271\n0\n272\n9\n273\n9\n0\nENDSEC'
  };
  const PART_TAGS = ['CAPPN', 'CAPPD', 'CAPMG', 'CAPMC', 'CAPGC', 'CAPALIAS1', 'CAPALIAS2', 'CAPALIAS3', 'CAPBLDG', 'CAPFLOOR', 'CAPDEPT', 'CAPPERSON', 'CAPPL', 'CAPTG', 'CAPQT', 'CAPDH'];
  const PANEL_TAGS = ['CAPSTD', 'CAPSTDTITLE', 'CAPPANELCAT', 'CAPPANELNAME', 'CAPPANELCONFIG', 'CAPPANELWIDTH', 'CAPPANELHEIGHT', 'CAPALIAS1', 'CAPALIAS2', 'CAPALIAS3'];
  // layers as CAP names them (AIA style), with CAP's colours
  const LAYER_COLOR = { '0': 7, 'Defpoints': 7, 'A-FURN': 7, 'A-FURN-P-PNLS-JNCT': 3, 'A-FURN-P-PNLS-JNCT-T': 3, 'A-FURN-PNLS-BUILDUP-T': 7, 'A-FURN-POINT-PART': 7, 'A-FURN-POINT-PART-T': 7, 'A-FURN-P-WKSF': 1, 'A-FURN-P-WKSF-T': 1, 'A-FURN-P-WKSF-SUP': 1, 'A-FURN-P-WKSF-SUP-T': 1, 'A-FURN-3-PEDS': 4, 'A-FURN-P-PEDS-T': 6, 'A-FURN-P-POWR': 5, 'A-FURN-P-POWR-T': 5, 'A-FURN-P-GEN': 3, 'CAPTAG': 7 };
  const panelLayer = (h) => 'A-FURN-P-PNLS-' + h;
  const ascii = (s) => String(s == null ? '' : s).replace(/×/g, 'x').replace(/°/g, ' deg').replace(/[—–]/g, '-').replace(/·/g, '-').replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/¾/g, '3/4').replace(/⅛/g, '1/8').replace(/⅜/g, '3/8').replace(/⅝/g, '5/8').replace(/⅞/g, '7/8').replace(/[^\x20-\x7e]/g, '');
  const num = (v) => { const r = Math.round(v * 1e6) / 1e6; return Number.isInteger(r) ? r.toFixed(1) : String(r); };
  const rad = (d) => d * Math.PI / 180;
  const rot2 = (deg, x, y) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return [x * c - y * s, x * s + y * c]; };
  const angOf = (dx, dy) => ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
  const blockName = (s) => 'P_' + String(s).replace(/[^A-Za-z0-9_$.\-]/g, '_');

  E.toCapDXF = function (P, res, opts) {
    opts = opts || {}; const ver = opts.version || 'AC1015';
    const out = []; const w = (c, v) => { out.push(String(c)); out.push(String(v)); };
    let hseed = 0x100; const H = () => (hseed++).toString(16).toUpperCase();
    const MSP = '17';
    const layers = new Set(['0', 'Defpoints', 'A-FURN', 'CAPTAG']); const useLayer = (l) => { layers.add(l); return l; };
    // ---------- block registry ----------
    // a block: { name, rec (record handle), geom: [{t:'line'|'point'|'circle'|'poly'|'text', ...}], attdefs: [{tag, pos, align, h, vis, style}], inserts: nested [{name, x, y, rot, attribs}] }
    const blocks = []; const byName = {}; const sigName = {};
    function block(style, sig, build, build3) { // one block per style; a second geometry for the same style gets a numbered name
      // build3 makes the block's 3D twin 3_<name> (CAP swaps P_ for 3_ in its 3D view and keeps definitions that are in the drawing); a part with no
      // body in the guide's terms (aligners, seals, power, packs) gets a point, as CAP's own library does
      const key = style + '|' + sig; if (sigName[key]) return sigName[key];
      let name = blockName(style), k = 2; while (byName[name]) name = blockName(style) + '_' + (k++);
      const b = { name, rec: H(), geom: [], attdefs: [], inserts: [] }; build(b); blocks.push(b); byName[name] = b; sigName[key] = name;
      const b3 = { name: '3_' + name.slice(2), rec: H(), geom: [], attdefs: [], inserts: [], three: true }; if (build3) build3(b3); else pt3(b3, L3.junction, [0, 0, 0]);
      b3.attdefs = b.attdefs; blocks.push(b3); byName[b3.name] = b3;
      return name;
    }
    const partAttdefs = (b, tlayer, tag) => { // the 16 CAP part attributes: all hidden at the origin except CAPTG, placed where CAP shows the tag
      for (const t of PART_TAGS) b.attdefs.push(t === 'CAPTG' && tag ? { tag: t, pos: tag.pos, align: tag.align || tag.pos, h: tag.h || 2.5, vis: true, style: tag.style || 'MONOTXT', layer: useLayer(tlayer) } : { tag: t, pos: [0, 0], h: 0.001, vis: false, style: 'Standard', layer: useLayer(tlayer) });
    };
    const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const sq = (b, layer, pts, closed) => b.geom.push({ t: 'poly', layer: useLayer(layer), pts, closed: closed !== false });
    const ln = (b, layer, a, c) => b.geom.push({ t: 'line', layer: useLayer(layer), a, b: c });
    const pt = (b, layer, p) => b.geom.push({ t: 'point', layer: useLayer(layer), p });
    // CAP junction symbols (from the CAP drawing): 3x3 corner block with the legs' inner lines, in-line and end-of-run posts
    function junctionBlock(style, type, c3) { // c3: { legs (local), omit } for the 3D twin
      const legs = c3 ? c3.legs : []; const sig3 = c3 ? '|' + legs.map(l => `${l.a}:${l.base}:${l.stack.join('+')}`).join(',') + (c3.omit ? '|omit' : '') : '';
      return block(style, 'J' + type + sig3, b => {
        const L = 'A-FURN-P-PNLS-JNCT';
        if (type === 'L' || type === 'T' || type === 'X') {
          ln(b, L, [0, 0], [3, 0]); ln(b, L, [3, 0], [3, 3]); ln(b, L, [3, 3], [0, 3]); ln(b, L, [0, 3], [0, 0]);
          if (type === 'L') { ln(b, L, [0, 1.5], [1.5, 1.5]); ln(b, L, [1.5, 1.5], [1.5, 0]); }
          if (type === 'T') { ln(b, L, [0, 1.5], [3, 1.5]); ln(b, L, [1.5, 1.5], [1.5, 0]); }
          if (type === 'X') { ln(b, L, [0, 1.5], [3, 1.5]); ln(b, L, [1.5, 0], [1.5, 3]); }
          for (const p of [[0, 0], [3, 0], [3, 3], [0, 3]]) pt(b, L, p);
          partAttdefs(b, L + '-T', { pos: [1.359, 6.073], align: type === 'T' ? [1.5, 3.716] : [3.716, 3.716] });
        } else if (type === 'V' || type === 'Y') { // the triangular 120 deg cap (p388), legs at 0, 120, 240 deg
          sq(b, L, E.cap120(0, 0, 0)); for (const p of E.cap120(0, 0, 0)) pt(b, L, p); partAttdefs(b, L + '-T', { pos: [0, 4], align: [0, 4] });
        } else if (type === 'inline') {
          sq(b, L, rect(-1, 0.5, 1, 2.5)); pt(b, L, [0, 3]); partAttdefs(b, L + '-T', { pos: [-3.542, 3.716], align: [0, 3.716] });
        } else { // end of run / wall start: the 1" finished end beyond the module
          ln(b, L, [0, 3], [1, 3]); ln(b, L, [1, 3], [1, 0]); ln(b, L, [1, 0], [0, 0]); for (const p of [[0, 3], [1, 3], [1, 0], [0, 0]]) pt(b, L, p);
          partAttdefs(b, L + '-T', { pos: [-1, -1.833], align: [-1, 1.5] });
        }
      }, c3 && legs.length ? (b3) => {
        const o = (type === 'L' || type === 'T' || type === 'X') ? [1.5, 1.5] : (type === 'V' || type === 'Y') ? [0, 0] : [0, 1.5]; // the node in the symbol's frame
        const lo = Math.min(...legs.map(l => l.top)), hi = Math.max(...legs.map(l => l.top)), post = Math.max(...legs.map(l => JH[l.base]));
        if (type === 'EOR' || type === 'wall') { junction3(b3, type, legs, o, 0, null, false, L3.junction); if (type === 'wall' && WALL_FACE) boxAlong3(b3, L3.junction, o, dirOf(legs[0].a), -WALL_FACE, 0, 1.5, 0, hi - capF); else if (!c3.omit) eorTrim3(b3, dirOf(legs[0].a), o, hi); }
        else { junction3(b3, type, legs, o, 0, null, true, L3.junction); if (!c3.omit && !legs.some(l => l.stack.length)) cap3(b3, type, legs, o, post, hi); if (!c3.omit && (type === 'L' || type === 'T') && hi - lo < 0.01) cornerTrim3(b3, type, legs, o, hi); }
        if (hi - lo > 0.01 && !c3.omit) cohTrim3(b3, type, legs, o, lo, hi); // a pre-configured change-of-height junction includes its trim (p40-47)
      } : null);
    }
    function frameBlock(style, wd, h, p, pkg) { // the panel frame/package: w x 3 outline on the height layer, tag w/h below the panel; 3D: base trim, top cap, package skins
      const s3 = p ? `|${p.height}:${(p.stack || []).join('+')}:${p.openBase ? 'o' : ''}${p.topCap && p.topCap.omit ? 'n' : ''}${pkg ? 'k' : ''}` : '';
      return block(style, 'F' + wd + 'x' + h + s3, b => { const L = panelLayer(h); sq(b, L, rect(0, 0, wd, 3)); for (const q of [[0, 3], [wd, 3], [wd, 0], [0, 0]]) pt(b, L, q); partAttdefs(b, L + '-T', { pos: [wd / 2, -5.5], align: [wd / 2, -5.5], h: 3 }); },
        p ? (b3) => frame3(b3, wd, p, pkg) : null);
    }
    // panel parts with a body of their own: skins and windows at their tile height, the glass screen, the stacking frame (no dimensions in the guide: a point)
    // junction parts placed at the node in the junction's own frame: stacking junctions, caps, vertical and change-of-height trims
    function nodePartBlock(l, type, legs, o) {
      const pid = l.pid || '', a = (E.rowsByStyle(l.style).find(r => r._pid === pid) || { attrs: {} }).attrs || {}; const sig = `NP${type}|` + legs.map(x => `${x.a}:${x.base}:${x.stack.join('+')}`).join(',');
      const lo = Math.min(...legs.map(x => x.top)), hi = Math.max(...legs.map(x => x.top)), post = Math.max(...legs.map(x => JH[x.base]));
      const mk = (build3) => block(l.style, sig, b => { pt(b, 'A-FURN-POINT-PART', [0, 0]); partAttdefs(b, 'A-FURN-POINT-PART-T'); }, build3);
      if (/stacking.*junction/.test(pid) && !/frame/.test(pid)) { // the stacking junction sits on the base junction (p32): its footprint, from the post height, its own height
        const st = a.stackHeight || 12; const leg = legs.reduce((m, x) => x.stack.includes(st) && (!m || JH[x.base] < JH[m.base]) ? x : m, null) || legs[0]; const z0 = JH[leg.base]; return mk(b3 => junction3(b3, type, legs, o, z0, z0 + (E.STACK_ACTUAL[st] || st), false, L3.stack)); }
      if (/junction-caps/.test(pid)) return mk(b3 => cap3(b3, type, legs, o, Math.max(...legs.map(stackTop)), hi));
      if (/end-of-run-vertical-trim/.test(pid)) return mk(b3 => eorTrim3(b3, dirOf(legs[0].a), o, AH(a.height || hi)));
      if (/l-t-vertical-trim|v-vertical-trim/.test(pid)) return mk(b3 => cornerTrim3(b3, type, legs, o, AH(a.height || hi)));
      if (/change-of-height-trim/.test(pid)) { const m = (l.desc || '').match(/\((\d+)"→(\d+)"/); const from = m ? +m[1] : lo, to = m ? +m[2] : hi; return mk(b3 => cohTrim3(b3, type, legs, o, from > 100 ? from : AH(from), to > 100 ? to : AH(to))); }
      return mk(null);
    }
    function pointBlock(style, layer) { return block(style, 'PT', b => { pt(b, layer || 'A-FURN-POINT-PART', [0, 0]); partAttdefs(b, (layer || 'A-FURN-POINT-PART') + '-T'); }); }
    function jobBlock(style) { return block(style, 'JOB', b => { pt(b, 'A-FURN', [0, 0]); sq(b, 'A-FURN', rect(-2, -2, 2, 2)); partAttdefs(b, 'A-FURN', { pos: [0, -5], align: [0, -5], h: 2, style: 'Standard' }); }); }
    function shapeBlock(style, sig, layer, pts, tag, extra, build3) { // closed outline with corner points (worksurfaces, pedestals, supports)
      return block(style, sig, b => { sq(b, layer, pts); for (const p of pts) if (p.length === 2) pt(b, layer, p); if (extra) extra(b); partAttdefs(b, layer + '-T', tag); }, build3 || null);
    }
    const sigOf = (pts) => pts.map(p => p.map(v => Math.round(v * 100) / 100).join(',')).join(';');
    // ---------- 3D bodies for CAP's 3D view: polyface meshes on CAP's 3D layers (AFUPA = panel parts, AFUSK = skins, colours as in the customer's drawing) ----------
    const L3 = { frame: 'AFUPA-3D-004', junction: 'AFUPA-3D-020', stack: 'AFUPA-3D-028', glass: 'AFUPA-3D-051', glassTrim: 'AFUPA-3D-010', skin: 'AFUSK-3D-017', window: 'AFUSK-3D-006', pane: 'AFUSK-3D-016' };
    const mesh3 = (b, layer, verts, faces) => b.geom.push({ t: 'mesh', layer: useLayer(layer), verts, faces });
    const pt3 = (b, layer, p) => b.geom.push({ t: 'point', layer: useLayer(layer), p, z: p[2] || 0 });
    const box3 = (b, layer, x0, y0, z0, x1, y1, z1) => mesh3(b, layer, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[1, 4, 3, 2], [5, 6, 7, 8], [1, 2, 6, 5], [2, 3, 7, 6], [3, 4, 8, 7], [4, 1, 5, 8]]);
    const face3 = (b, layer, q) => mesh3(b, layer, q, [[1, 2, 3, 4]]);
    const prism3 = (b, layer, poly, z0, z1, centre) => { // a plan outline extruded: side quads, top and bottom fanned from a point inside the outline
      const n = poly.length; const verts = [...poly.map(p => [p[0], p[1], z0]), ...poly.map(p => [p[0], p[1], z1]), [centre[0], centre[1], z0], [centre[0], centre[1], z1]]; const faces = [];
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([i + 1, j + 1, j + 1 + n, i + 1 + n]); faces.push([2 * n + 1, j + 1, i + 1]); faces.push([2 * n + 2, i + 1 + n, j + 1 + n]); }
      mesh3(b, layer, verts, faces); };
    // a box along a direction: from d0 to d1 along the unit vector u from point c (plan), half-width hw across, z0..z1
    const boxAlong3 = (b, layer, c, u, d0, d1, hw, z0, z1) => { const n = [-u[1], u[0]]; const q = [[c[0] + u[0] * d0 + n[0] * hw, c[1] + u[1] * d0 + n[1] * hw], [c[0] + u[0] * d1 + n[0] * hw, c[1] + u[1] * d1 + n[1] * hw], [c[0] + u[0] * d1 - n[0] * hw, c[1] + u[1] * d1 - n[1] * hw], [c[0] + u[0] * d0 - n[0] * hw, c[1] + u[1] * d0 - n[1] * hw]]; prism3(b, layer, q, z0, z1, [c[0] + u[0] * (d0 + d1) / 2, c[1] + u[1] * (d0 + d1) / 2]); };
    // the guide's dimensions the bodies are built from (thin trim; oval where it differs)
    const frac = (v) => { const m = String(v).replace('"', '').trim().match(/^(\d+)(?:\s+(\d+)\/(\d+))?$/); return m ? +m[1] + (m[2] ? +m[2] / +m[3] : 0) : +v || 0; };
    const trim = P.trim === 'oval' ? 'oval' : 'thin';
    const JH = {}; for (const [h, v] of Object.entries(E.ACTUAL.junctionHeight)) JH[h] = frac(v); // junction post heights p20: 28 7/16, 40 3/4, 47, 53 1/8, 65 1/2, 77 3/8
    const AH = (h) => E.actualBaseHeight(trim, h); // floor to top of top cap, glides retracted p16 (oval p90)
    const capF = E.CAP_FACE[trim] || 0.625; // the top cap's visible lip: 5/8" thin, 1" oval (the app's elevation convention)
    const BT = E.BASE_TRIM_H; // base trim 3 3/4" p58
    const skinScale = (h) => (AH(h) - BT - capF) / (h - E.SKIN_TRIM_ALLOWANCE); // nominal skins (height - 6, p19) fill the actual height between base trim and cap lip, as the elevation draws them
    const stackScale = (st) => (E.STACK_ACTUAL[st] || st) / st; // stacking junctions 12 3/8, 18 1/2, 24 3/4 p32
    const GLASS_H = E.GLASS.recessed.heights, GLASS_T = 0.375, GLASS_END = 0.0625; // recessed frameless glass, 2022 p64: 6/12/18/24"H kits (2022 p396-p398) with 9 5/16", 15 1/2", 21 11/16", 27 7/8" glass, 3/8" thick, 1/8" between screens
    const EOR_TRIM = E.FOOTPRINT[trim].eor, WALL_FACE = E.FOOTPRINT[trim].wall; // finished end 1/2" thin (p20), 1" oval (p92); wall start 3/16" thin (p21)
    const stackTop = (leg) => JH[leg.base] + (leg.stack || []).reduce((a, st) => a + (E.STACK_ACTUAL[st] || st), 0); // the junction with its stacking junctions
    const omitTrim = (l) => /omit trim/i.test(l.spec || '');
    // where a junction's legs sit in the block's own frame: local angle, base height, stack, total, actual top
    const legsLocal = (J, r) => J.legs.map(l => ({ a: ((l.angle - r) % 360 + 360) % 360, base: l.base, total: l.total, stack: l.panel.stack || [], top: E.actualTop(trim, l.panel) }));
    const dirOf = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];
    // junction bodies (block-and-post, p20, p21): a 3" block with a 3/4" post on each leg from the block face to the skins (E.CORNER_ALLOW), the cap on top
    // from the post height to the top of the tallest top cap (p16 - p20); in-line 1 1/2" (p30); end of run 3/4" post inside the module with the 1/2" trim
    // beyond (p20); V/Y the triangular 120 deg cap footprint (p388). Stacking junctions repeat the footprint from the post height for their own height (p32).
    function junction3(b, type, legs, o, z0, z1, withPosts, layer) { // o: the node in block coordinates; z0..z1 the body; posts to each leg's own height
      const hi = Math.max(...legs.map(l => JH[l.base]));
      if (type === 'L' || type === 'T' || type === 'X') { box3(b, layer, o[0] - 1.5, o[1] - 1.5, z0, o[0] + 1.5, o[1] + 1.5, z1 == null ? hi : z1); }
      else if (type === 'V' || type === 'Y') { prism3(b, layer, E.cap120(o[0], o[1], legs[0].a), z0, z1 == null ? hi : z1, o); }
      else if (type === 'inline') { box3(b, layer, o[0] - E.JUNCTION_W / 2, o[1] - 1.5, z0, o[0] + E.JUNCTION_W / 2, o[1] + 1.5, z1 == null ? hi : z1); }
      else { const u = dirOf(legs[0].a); boxAlong3(b, layer, o, u, 0, E.EOR_POST, 1.5, z0, z1 == null ? JH[legs[0].base] : z1); } // EOR / wall: the post inside the module
      if (withPosts && (type === 'L' || type === 'T' || type === 'X' || type === 'V' || type === 'Y')) { const ca = E.cornerAllow(type); for (const l of legs) boxAlong3(b, layer, o, dirOf(l.a), ca, ca + E.EOR_POST, 1.5, z0, JH[l.base]); }
    }
    function cap3(b, type, legs, o, z0, z1) { // the junction cap on the block footprint
      if (type === 'V' || type === 'Y') prism3(b, L3.junction, E.cap120(o[0], o[1], legs[0].a), z0, z1, o); else box3(b, L3.junction, o[0] - 1.5, o[1] - 1.5, z0, o[0] + 1.5, o[1] + 1.5, z1);
    }
    // change-of-height trim: on the taller junction's face toward the lower leg, from the lower top cap to the taller one (p24); thin trim half the junction wide (E.cohTrimWidth)
    function cohTrim3(b, type, legs, o, low, high) {
      const wT = E.cohTrimWidth(P); for (const l of legs.filter(x => Math.abs(x.top - low) < 0.01)) { const u = dirOf(l.a), n = [-u[1], u[0]]; const f = (type === 'inline' || type === 'EOR' || type === 'wall') ? E.JUNCTION_W / 2 : 1.5; const c = [o[0] + u[0] * f, o[1] + u[1] * f];
        face3(b, L3.junction, [[c[0] + n[0] * wT / 2, c[1] + n[1] * wT / 2, low - capF], [c[0] - n[0] * wT / 2, c[1] - n[1] * wT / 2, low - capF], [c[0] - n[0] * wT / 2, c[1] - n[1] * wT / 2, high - capF], [c[0] + n[0] * wT / 2, c[1] + n[1] * wT / 2, high - capF]]); }
    }
    // vertical trim on a corner block's exposed faces (L: the two faces away from the legs, T: the face opposite the stem), floor to the cap lip (p380-382)
    function cornerTrim3(b, type, legs, o, top) {
      const used = legs.map(l => Math.round(l.a / 90) % 4); for (const k of [0, 1, 2, 3]) { if (used.includes(k)) continue; const u = dirOf(k * 90), n = [-u[1], u[0]]; const c = [o[0] + u[0] * 1.5, o[1] + u[1] * 1.5];
        face3(b, L3.junction, [[c[0] + n[0] * 1.5, c[1] + n[1] * 1.5, 0], [c[0] - n[0] * 1.5, c[1] - n[1] * 1.5, 0], [c[0] - n[0] * 1.5, c[1] - n[1] * 1.5, top - capF], [c[0] + n[0] * 1.5, c[1] + n[1] * 1.5, top - capF]]); }
    }
    const eorTrim3 = (b, u, o, top) => boxAlong3(b, L3.junction, o, u, -EOR_TRIM, 0, 1.5, 0, top - capF); // the finished end beyond the post, to the cap lip
    // the frame or panel package: base trim (p58), top cap at the actual height (p16, moved up by stackers p32); a package carries its skins too (p78)
    function frame3(b, wd, p, pkg) {
      const top = E.actualTop(trim, p);
      if (!p.openBase) box3(b, L3.frame, 0, 0, 0, wd, 3, BT); else box3(b, L3.frame, 0, 0, 0, wd, 3, E.OPEN_BASE.height - E.OPEN_BASE.opening); // open base: bottom 3 1/4" with a 2 1/2" opening (p59)
      if (!p.topCap.omit) box3(b, L3.frame, 0, 0, top - capF, wd, 3, top);
      if (pkg) for (const y of [0, 3]) face3(b, L3.skin, [[0, y, BT], [wd, y, BT], [wd, y, AH(p.height) - capF], [0, y, AH(p.height) - capF]]);
    }
    // tile bodies at their own origin, the way CAP's library draws them (its claude-request samples, 2026-09-25): a skin is the face it shows, on
    // y = 0 from x = 0 to its width, from z = 0 up (its thickness is not in the guide); a window tile is its outline around the 3" depth with the pane on
    // the centreline (p59 gives heights, not frame members); recessed frameless glass is the p64 glass, 3/8" thick on the centreline, 1/16" short of
    // each module line (1/2" at a change of height), from z = 0 up. CAP nests the symbol where the tile sits and lifts it by CAPDH, so the config does the same.
    const skin3 = (b, w, hz) => face3(b, L3.skin, [[0, 0, 0], [w, 0, 0], [w, 0, hz], [0, 0, hz]]);
    function window3(b, w, hz) {
      face3(b, L3.window, [[0, 0, 0], [w, 0, 0], [w, 3, 0], [0, 3, 0]]); face3(b, L3.window, [[0, 0, hz], [w, 0, hz], [w, 3, hz], [0, 3, hz]]);
      face3(b, L3.window, [[0, 0, 0], [0, 3, 0], [0, 3, hz], [0, 0, hz]]); face3(b, L3.window, [[w, 0, 0], [w, 3, 0], [w, 3, hz], [w, 0, hz]]);
      face3(b, L3.pane, [[0, 1.5, 0], [w, 1.5, 0], [w, 1.5, hz], [0, 1.5, hz]]);
    }
    const glass3 = (b, wd, gh, endLo, endHi) => box3(b, L3.glass, endLo, 1.5 - GLASS_T / 2, 0, wd - endHi, 1.5 + GLASS_T / 2, gh);
    // ---------- entity writers ----------
    const ent = (type, owner, layer) => { const h = H(); w(0, type); w(5, h); w(330, owner); w(100, 'AcDbEntity'); w(8, layer); return h; };
    function writeGeom(g, owner) {
      if (g.t === 'line') { ent('LINE', owner, g.layer); w(100, 'AcDbLine'); w(10, num(g.a[0])); w(20, num(g.a[1])); w(30, '0.0'); w(11, num(g.b[0])); w(21, num(g.b[1])); w(31, '0.0'); }
      else if (g.t === 'point') { ent('POINT', owner, g.layer); w(100, 'AcDbPoint'); w(10, num(g.p[0])); w(20, num(g.p[1])); w(30, num(g.z || 0)); }
      else if (g.t === 'mesh') { const hp = ent('POLYLINE', owner, g.layer); w(100, 'AcDbPolyFaceMesh'); w(66, 1); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(70, 64); w(71, g.verts.length); w(72, g.faces.length);
        // vertices and face records are owned by the POLYLINE, and a face record carries AcDbFaceRecord alone (no AcDbVertex marker): the encoding CAP's own
        // drawings use; CAP's reader rejected the file ("error reading VERTEX") with the extra marker (2026-09-25)
        for (const v of g.verts) { ent('VERTEX', hp, g.layer); w(100, 'AcDbVertex'); w(100, 'AcDbPolyFaceMeshVertex'); w(10, num(v[0])); w(20, num(v[1])); w(30, num(v[2])); w(70, 192); }
        for (const f of g.faces) { ent('VERTEX', hp, g.layer); w(100, 'AcDbFaceRecord'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(70, 128); f.forEach((i, k) => w(71 + k, i)); }
        ent('SEQEND', hp, g.layer); }
      else if (g.t === 'circle') { ent('CIRCLE', owner, g.layer); w(100, 'AcDbCircle'); w(10, num(g.c[0])); w(20, num(g.c[1])); w(30, '0.0'); w(40, num(g.r)); }
      else if (g.t === 'poly') { const hp = ent('POLYLINE', owner, g.layer); w(100, 'AcDb2dPolyline'); w(66, 1); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(70, g.closed ? 1 : 0);
        for (const p of g.pts) { ent('VERTEX', owner, g.layer); w(100, 'AcDbVertex'); w(100, 'AcDb2dVertex'); w(10, num(p[0])); w(20, num(p[1])); w(30, '0.0'); if (p[2]) w(42, num(p[2])); w(70, 0); }
        ent('SEQEND', hp, g.layer); }
      else if (g.t === 'text') { ent('TEXT', owner, g.layer); w(100, 'AcDbText'); w(10, num(g.p[0])); w(20, num(g.p[1])); w(30, '0.0'); w(40, num(g.h)); w(1, ascii(g.s)); if (g.rot) w(50, num(g.rot)); if (g.center) { w(72, 1); w(11, num(g.p[0])); w(21, num(g.p[1])); w(31, '0.0'); } w(100, 'AcDbText'); }
    }
    function writeAttdef(a, owner) {
      ent('ATTDEF', owner, a.layer); w(100, 'AcDbText'); w(10, num(a.pos[0])); w(20, num(a.pos[1])); w(30, '0.0'); w(40, num(a.h)); w(1, '');
      if (a.vis) { w(7, a.style); w(72, 1); w(11, num(a.align[0])); w(21, num(a.align[1])); w(31, '0.0'); }
      w(100, 'AcDbAttributeDefinition'); w(3, ''); w(2, a.tag); w(70, a.vis ? 0 : 1);
    }
    function writeInsert(ins, owner) { // ins: { name, x, y, rot, layer, attribs: {tag: value} }; attribute positions follow the block's ATTDEFs, rotated with the insert
      const b = byName[ins.name]; const hi = ent('INSERT', owner, ins.layer || 'A-FURN'); w(100, 'AcDbBlockReference'); if (b.attdefs.length) w(66, 1); w(2, ins.name); w(10, num(ins.x)); w(20, num(ins.y)); w(30, num(ins.z || 0)); if (ins.rot) w(50, num(ins.rot));
      for (const a of b.attdefs) {
        const p = a.vis ? rot2(ins.rot || 0, a.pos[0], a.pos[1]) : [0, 0]; ent('ATTRIB', owner, a.layer); w(100, 'AcDbText'); w(10, num(ins.x + p[0])); w(20, num(ins.y + p[1])); w(30, '0.0'); w(40, num(a.h)); w(1, ascii(ins.attribs[a.tag] || ''));
        if (a.vis) { if (ins.rot) w(50, num(ins.rot)); w(7, a.style); w(72, 1); const q = rot2(ins.rot || 0, a.align[0], a.align[1]); w(11, num(ins.x + q[0])); w(21, num(ins.y + q[1])); w(31, '0.0'); }
        w(100, 'AcDbAttribute'); w(2, a.tag); w(70, a.vis ? 0 : 1);
      }
      if (b.attdefs.length) ent('SEQEND', hi, ins.layer || 'A-FURN');
    }
    // ---------- what goes where ----------
    const lines = (res.lines || []).filter(l => l.qty > 0); const bySrc = {}; for (const l of lines) (bySrc[l.src] = bySrc[l.src] || []).push(l);
    const left = new Map(lines.map(l => [l, l.qty])); // units of each line still to place: every unit becomes one INSERT
    const stations = {}; (E.workstations ? E.workstations(P) : []).forEach((g, i) => { const nm = g.name || ('Workstation ' + (i + 1)); for (const p of g.panels || []) stations[p.id] = nm; for (const ws of g.ws || []) stations[ws.id] = nm; });
    const stationOf = (id) => stations[id] || '';
    const attrs = (l, tag, extra) => Object.assign({ CAPPN: l.style === '—' ? '' : l.style, CAPPD: (l.desc || '').slice(0, 120), CAPMG: 'STC', CAPMC: 'TSA', CAPGC: '', CAPALIAS1: '', CAPALIAS2: '', CAPALIAS3: '', CAPBLDG: '', CAPFLOOR: '', CAPDEPT: '', CAPPERSON: '', CAPPL: (Math.round((l.unit || 0) * 100) / 100).toFixed(4), CAPTG: tag || '', CAPQT: '1', CAPDH: '0' }, extra || {});
    const top = []; // top-level inserts
    const place = (l, name, x, y, rot, tag, extra, layer) => { if (!left.get(l)) return false; left.set(l, left.get(l) - 1); top.push({ name, x, y, rot: ((rot % 360) + 360) % 360, layer, attribs: attrs(l, tag, extra) }); return true; };
    const isPanelLine = (l) => l.cat === 'Panel' || l.cat === 'Frame';
    const nodes = res.nodes || {};
    const cornerAllow = (nid) => { const J = nodes[nid]; return J && J.legs && J.legs.length ? (E.cornerAllow ? E.cornerAllow(J.type) : 0) : 0; };
    // panels: one config block per distinct build (width, height, nested parts); the frame carries the outline, the other parts are point parts along it
    const configs = {}; let cfgN = 0; const letter = (i) => { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
    for (const p of Object.values(P.panels)) {
      const a = P.nodes[p.a], c = P.nodes[p.b]; if (!a || !c) continue; const L = Math.hypot(c.x - a.x, c.y - a.y) || 1; const d = [(c.x - a.x) / L, (c.y - a.y) / L]; const r = angOf(d[0], d[1]);
      const ins = [a.x + d[0] * cornerAllow(p.a) + d[1] * 1.5, a.y + d[1] * cornerAllow(p.a) - d[0] * 1.5]; // module starts at the corner face; the frame is drawn to the left of the run, so the insert is on its right face
      const wd = p.width, ht = E.panelTotalHeight(p); const mine = bySrc[p.id] || []; const nested = mine.filter(l => l.cat !== 'Power'), power = mine.filter(l => l.cat === 'Power');
      const sig = [wd, ht, ...nested.map(l => l.style + 'x' + l.qty + '|' + (l.desc || '')).sort()].join('~');
      if (opts.flat) { // every panel part as its own top-level insert, no config block
        const frame = nested.find(isPanelLine) || nested[0]; if (frame) place(frame, frameBlock(frame.style, wd, ht, p, /panel-package/.test(frame.pid || '')), ins[0], ins[1], r, wd + '/' + ht, { CAPALIAS1: stationOf(p.id) });
        const units = []; for (const l of nested) for (let i = 0; i < (l === frame ? left.get(l) : l.qty); i++) units.push(l);
        units.forEach((l, i) => { const q = rot2(r, wd * (i + 1) / (units.length + 1), 1.5); place(l, pointBlock(l.style), ins[0] + q[0], ins[1] + q[1], r, '', { CAPALIAS1: stationOf(p.id) }); });
        const pu = []; for (const l of power) for (let i = 0; i < l.qty; i++) pu.push(l);
        pu.forEach((l, i) => { const q = rot2(r, wd * (i + 1) / (pu.length + 1), -2.5); place(l, pointBlock(l.style, 'A-FURN-P-POWR'), ins[0] + q[0], ins[1] + q[1], r, '', { CAPALIAS1: stationOf(p.id) }); });
        continue;
      }
      if (!configs[sig]) {
        const id = letter(cfgN++); const frame = nested.find(isPanelLine) || nested[0]; const rest = nested.filter(l => l !== frame);
        const units = []; for (const l of rest) for (let i = 0; i < l.qty; i++) units.push(l);
        const pkg = !!(frame && /panel-package/.test(frame.pid || '')); const frameName = frame ? frameBlock(frame.style, wd, ht, p, pkg) : null;
        // CAP builds the 3D panel from the 2D config itself (on opening a file it says the panel builder graphics need updating and redraws them): each
        // nested symbol stays where the 2D config puts it, is swapped for its 3_ twin and lifted by its CAPDH (the owner's claude-request samples,
        // 2026-09-25). CAP's own configs nest the frame at the origin, the side B skin at (0, 3) and the side A skin at (width, 0) turned 180 degrees,
        // both with CAPDH = the base trim height, and a window tile at the origin with CAPDH = its bottom. The config follows that scheme exactly with
        // the guide's heights, so the bodies land on the panel whether CAP uses our twins or redraws from its library.
        const rowOf = (l) => E.rowsByStyle(l.style).find(r => r._pid === l.pid) || { attrs: {} };
        const bodies = new Map(); const usedB = new Set(); const takeB = (pred) => { const l = rest.find(x => !usedB.has(x) && pred(x)); if (l) usedB.add(l); return l; };
        const tileLine = (side, sg) => sg.kind === 'window' ? (side === 0 ? takeB(x => /glass-windows|window-kits/.test(x.pid || '') && (rowOf(x).attrs.height || 0) === sg.height) : null) : takeB(x => x.cat === 'Skins' && new RegExp('side ' + (side + 1)).test(x.desc || '') && (rowOf(x).attrs.height || 0) === sg.height);
        const tileBody = (side, sg, hz, z0) => sg.kind === 'window' ? { key: `W${wd}x${hz.toFixed(3)}`, x: 0, y: 0, rot: 0, z0, build: b3 => window3(b3, wd, hz) }
          : { key: `S${wd}x${hz.toFixed(3)}`, x: side === 0 ? wd : 0, y: side === 0 ? 0 : 3, rot: side === 0 ? 180 : 0, z0, build: b3 => skin3(b3, wd, hz) };
        for (const side of [0, 1]) { // base tiles from the base trim up, scaled to fill to the cap lip (p16, p19); stack tiers above at the stacking junction heights (p32)
          let z = BT; const k = skinScale(p.height);
          for (const sg of p.sides[side]) { const hz = sg.height * k; const l = tileLine(side, sg); if (l) bodies.set(l, tileBody(side, sg, hz, z)); z += hz; }
          let zt = AH(p.height) - capF;
          (p.stack || []).forEach((st, i) => { const ks = stackScale(st); for (const sg of (p.stackSides[i] || [[], []])[side] || []) { const hz = sg.height * ks; const l = tileLine(side, sg); if (l) bodies.set(l, tileBody(side, sg, hz, zt)); zt += hz; } });
        }
        { const gl = takeB(x => /frameless-glass/.test(x.pid || '')); if (gl) { const kit = rowOf(gl).attrs.height || (p.glassScreen && p.glassScreen.height) || 12; const endOf = (nid) => { const J = nodes[nid]; const coh = J && J.type === 'inline' && new Set(J.legs.map(l => l.total)).size > 1; return coh ? E.GLASS.recessed.cohEnd : GLASS_END; }; const top = E.actualTop(trim, p), e0 = endOf(p.a), e1 = endOf(p.b), gh = GLASS_H[kit] || kit;
          bodies.set(gl, { key: `G${wd}x${gh}x${e0}x${e1}`, x: 0, y: 0, rot: 0, z0: top + kit - gh, build: b3 => glass3(b3, wd, gh, e0, e1) }); } } // the glass top stands the kit height above the top cap (p64)
        const placed = []; const bodyDone = new Set();
        const unitBlock = (l, i) => { const body = bodies.get(l) && !bodyDone.has(l) ? (bodyDone.add(l), bodies.get(l)) : null;
          const u = body ? { nm: block(l.style, `T|${body.key}`, b => { pt(b, 'A-FURN-POINT-PART', [0, 0]); partAttdefs(b, 'A-FURN-POINT-PART-T'); }, b3 => body.build(b3)), x: body.x, y: body.y, rot: body.rot, z: body.z0 }
            : { nm: pointBlock(l.style), x: wd * (i + 1) / (units.length + 1), y: 1.5, rot: 0, z: 0 }; // parts without a body stay point symbols along the centreline
          placed.push({ ...u, l }); return u; };
        const name = block(id + wd, 'CFG', b => {
          if (frame) b.inserts.push({ name: frameName, x: 0, y: 0, rot: 0, attribs: attrs(frame, wd + '/' + ht) });
          units.forEach((l, i) => { const u = unitBlock(l, i); b.inserts.push({ name: u.nm, x: u.x, y: u.y, rot: u.rot, attribs: attrs(l, '', { CAPDH: String(+u.z.toFixed(4)) }) }); });
          for (const t of PANEL_TAGS) b.attdefs.push(t === 'CAPSTD' ? { tag: t, pos: [wd / 2, 4.5], align: [wd / 2, 4.5], h: 3, vis: true, style: 'Standard', layer: useLayer('A-FURN-PNLS-BUILDUP-T') } : { tag: t, pos: [0, 0], h: 0.001, vis: false, style: 'Standard', layer: 'A-FURN-PNLS-BUILDUP-T' });
        }, (b3) => { // the 3D config as CAP writes it: the same inserts as the 2D one, each lifted to its CAPDH
          if (frame) b3.inserts.push({ name: '3_' + frameName.slice(2), x: 0, y: 0, z: 0, rot: 0, attribs: attrs(frame, wd + '/' + ht) });
          for (const u of placed) b3.inserts.push({ name: '3_' + u.nm.slice(2), x: u.x, y: u.y, z: u.z, rot: u.rot, attribs: attrs(u.l, '', { CAPDH: String(+u.z.toFixed(4)) }) });
        }); byName[name].cfg = true;
        // CAP names configs P_<name><width>.000000, so the 3D twin is 3_<name><width>.000000
        const cap = 'P_' + id + wd + '.000000'; byName[cap] = byName[name]; delete byName[name]; byName[cap].name = cap;
        const n3 = '3_' + name.slice(2), c3 = '3_' + cap.slice(2); byName[c3] = byName[n3]; delete byName[n3]; byName[c3].name = c3;
        configs[sig] = { id, name: cap, wd, ht, frame, rest, title: `${wd}" x ${ht}" panel config ${id}: ` + nested.map(l => l.style + (l.qty > 1 ? ' x' + l.qty : '')).join(', ') };
      }
      const cfg = configs[sig];
      for (const l of nested) left.set(l, 0); // placed inside the config block, once per panel that uses it
      top.push({ name: cfg.name, x: ins[0], y: ins[1], rot: r, layer: 'A-FURN', attribs: { CAPSTD: cfg.id + ' ' + wd, CAPSTDTITLE: ascii(cfg.title), CAPPANELCAT: 'TSA', CAPPANELNAME: cfg.id, CAPPANELCONFIG: '', CAPPANELWIDTH: wd.toFixed(6), CAPPANELHEIGHT: ht.toFixed(6), CAPALIAS1: stationOf(p.id), CAPALIAS2: p.label || '', CAPALIAS3: '' } });
      // power parts beside the panel, on its right face
      const pu = []; for (const l of power) for (let i = 0; i < l.qty; i++) pu.push(l);
      pu.forEach((l, i) => { const q = rot2(r, wd * (i + 1) / (pu.length + 1), -2.5); place(l, pointBlock(l.style, 'A-FURN-P-POWR'), ins[0] + q[0], ins[1] + q[1], r, '', { CAPALIAS1: stationOf(p.id) }); });
    }
    // junctions: the first Junction line takes the CAP symbol, the rest (trims, stacking, caps) are point parts around the node
    for (const n of Object.values(P.nodes)) {
      const J = nodes[n.id]; if (!J || !J.legs || !J.legs.length) continue; const mine = bySrc[n.id] || []; if (!mine.length) continue;
      const legs = J.legs.map(l => ((l.angle % 360) + 360) % 360); let r = 0, ins = [n.x, n.y]; const t = J.type;
      if (t === 'L' || t === 'T' || t === 'X') {
        if (t === 'L') { const [x, y] = legs; const b = ((y - x + 360) % 360 === 90) ? x : y; r = (b - 180 + 360) % 360; }
        else if (t === 'T') { const stem = legs.find(l => !legs.some(o => Math.abs(((o - l + 540) % 360) - 180) < 1)); r = ((stem === undefined ? legs[0] : stem) + 90) % 360; }
        else r = legs[0] % 90;
        const q = rot2(r, 1.5, 1.5); ins = [n.x - q[0], n.y - q[1]];
      } else if (t === 'V' || t === 'Y') { r = legs[0]; }
      else if (t === 'inline') { r = legs[0]; const q = rot2(r, 0, -1.5); ins = [n.x + q[0], n.y + q[1]]; }
      else { r = (legs[0] + 180) % 360; const q = rot2(r, 0, -1.5); ins = [n.x + q[0], n.y + q[1]]; }
      const first = mine.find(l => l.cat === 'Junction') || mine[0]; const hts = [...new Set(J.legs.map(l => l.total))].sort((a, b) => a - b).join('/');
      const jtag = ({ L: 'L', T: 'T', X: 'X', V: 'V', Y: 'Y', inline: 'I', EOR: 'E', wall: 'W' }[t] || t) + hts;
      const legsL = legsLocal(J, r); const o3 = (t === 'L' || t === 'T' || t === 'X') ? [1.5, 1.5] : (t === 'V' || t === 'Y') ? [0, 0] : [0, 1.5];
      place(first, junctionBlock(first.style, t, { legs: legsL, omit: omitTrim(first) }), ins[0], ins[1], r, jtag, { CAPALIAS1: stationOf(J.legs[0].panel.id) });
      const units = []; for (const l of mine) for (let i = 0; i < (l === first ? left.get(l) : l.qty); i++) units.push(l);
      // parts with a body at the junction (stacking junctions, caps, trims) sit on the node in the symbol's frame, so their 3D twins are right; the rest ring it
      const bodied = (l) => /stacking.*junction|junction-caps|vertical-trim|change-of-height-trim/.test(l.pid || '') && !/frame/.test(l.pid || '');
      let ring = 0; units.forEach((l) => { if (bodied(l)) place(l, nodePartBlock(l, t, legsL, o3), ins[0], ins[1], r, '', { CAPALIAS1: stationOf(J.legs[0].panel.id) }); else { const a = 45 + 60 * (ring++); place(l, pointBlock(l.style), n.x + Math.cos(rad(a)) * 2.5, n.y + Math.sin(rad(a)) * 2.5, 0, '', { CAPALIAS1: stationOf(J.legs[0].panel.id) }); } });
    }
    // worksurfaces: outline block, then supports at their positions, pedestals in their footprints, fillers and the rest as point parts
    const pending = []; // geometry positions that project-level lines (side bracket pairs, tie plate packs) may take
    const tiePts = [];
    for (const ws of Object.values(P.worksurfaces || {})) {
      const g = E.wsGeometry(P, ws); if (!g) continue; const mine = bySrc[ws.id] || []; const st = stationOf(ws.id) || stationOf(ws.panel);
      const wl = mine.find(l => l.cat === 'Worksurface');
      const outline = g.outline || g.poly; const o = outline[0]; const r = angOf(outline[1][0] - o[0], outline[1][1] - o[1]);
      let loc = outline.map(p => rot2(-r, p[0] - o[0], p[1] - o[1]));
      if (g.curve && g.curveAt != null) { // the cove as one arc: bulge = 2 x sagitta / chord, sign from the curve's side
        const [F1, C, F2] = g.curve; const Q = [0.25 * F1[0] + 0.5 * C[0] + 0.25 * F2[0], 0.25 * F1[1] + 0.5 * C[1] + 0.25 * F2[1]]; const M = [(F1[0] + F2[0]) / 2, (F1[1] + F2[1]) / 2];
        const chord = Math.hypot(F2[0] - F1[0], F2[1] - F1[1]) || 1; const sag = Math.hypot(Q[0] - M[0], Q[1] - M[1]); const cross = (F2[0] - F1[0]) * (Q[1] - M[1]) - (F2[1] - F1[1]) * (Q[0] - M[0]);
        loc = loc.map((p, i) => i === g.curveAt ? [p[0], p[1], (cross >= 0 ? 1 : -1) * 2 * sag / chord] : p);
      }
      const tag = ws.kind === 'straight' ? `${ws.width}/${ws.depth}` : `${ws.depthA}/${ws.C}/${ws.D}/${ws.depthB}`;
      const cx = loc.reduce((s, p) => s + p[0], 0) / loc.length, cy = loc.reduce((s, p) => s + p[1], 0) / loc.length;
      const poly3 = g.poly.map(p => rot2(-r, p[0] - o[0], p[1] - o[1])), inner3 = g.o ? rot2(-r, g.o[0] - o[0], g.o[1] - o[1]) : [poly3.reduce((s, q) => s + q[0], 0) / poly3.length, poly3.reduce((s, q) => s + q[1], 0) / poly3.length];
      if (wl) place(wl, shapeBlock(wl.style, 'W' + sigOf(loc), 'A-FURN-P-WKSF', loc, { pos: [cx, cy - 1.2], align: [cx, cy - 1.2], h: 2.4, style: 'Standard' }, null, b3 => prism3(b3, 'A-FURN-P-WKSF', poly3, E.WS_HEIGHT - E.WS_THICK, E.WS_HEIGHT, inner3)), o[0], o[1], r, tag, { CAPALIAS1: st }); // 1 3/16" thick at 28 1/2" (p222)
      // supports (p223/224/225/227/234/235/236/237): drawn from the panel face toward the front
      const kindPid = { cantilever: /cantilever/, csp: /center-support/, endpanel: /end-panel/, leg: /post-leg/, ssb: /side-support/ };
      for (const s of ws._supports || []) {
        const rx = kindPid[s.kind]; if (!rx) continue; const n = s.n; const rr = angOf(n[0], -n[1]) ; // block -y points to the front (n)
        const rs = angOf(-n[1], n[0]) - 90; const face = [s.at[0] + n[0] * 1.5, s.at[1] + n[1] * 1.5];
        const bname = (style) => s.kind === 'cantilever' ? block(style, 'CANT', b => { sq(b, 'A-FURN-P-WKSF-SUP', [[-1.42, 0], [1.42, 0], [1.3, -15.5], [-1.3, -15.5]]); ln(b, 'A-FURN-P-WKSF-SUP', [0, 0], [0, -15.5]); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T'); })
          : s.kind === 'csp' ? block(style, 'CSP', b => { sq(b, 'A-FURN-P-WKSF-SUP', rect(-0.5, 0, 0.5, -11)); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T'); })
          : s.kind === 'endpanel' ? block(style, 'EP' + s.depth, b => { sq(b, 'A-FURN-P-WKSF-SUP', rect(-0.5, 0, 0.5, -(s.depth || 24))); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T'); })
          : s.kind === 'leg' ? block(style, 'LEG', b => { b.geom.push({ t: 'circle', layer: useLayer('A-FURN-P-WKSF-SUP'), c: [0, -((s.depth || 24) - 2)], r: 1.25 }); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T'); })
          : block(style, 'SSB', b => { sq(b, 'A-FURN-P-WKSF-SUP', rect(-3, 0, 3, -1)); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T', { pos: [0, -3.5], align: [0, -3.5], h: 2, style: 'Standard' }); });
        const own = mine.find(l => l.cat === 'Supports' && rx.test(l.pid) && left.get(l));
        if (own) place(own, bname(own.style), face[0], face[1], rs, s.kind === 'ssb' ? 'SS' : '', { CAPALIAS1: st });
        else pending.push({ rx, x: face[0], y: face[1], rot: rs, bname, tag: s.kind === 'ssb' ? 'SS' : '', st });
      }
      if (g.kind !== 'straight' && g.o) pending.push({ rx: /side-support/, x: g.o[0], y: g.o[1], rot: 0, bname: (style) => block(style, 'SSB', b => { sq(b, 'A-FURN-P-WKSF-SUP', rect(-3, 0, 3, -1)); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T', { pos: [0, -3.5], align: [0, -3.5], h: 2, style: 'Standard' }); }), tag: 'SS', st }); // side support bracket at a corner worksurface's rear corner (p588)
      for (const t of ws._tie || []) tiePts.push({ x: t.pt[0], y: t.pt[1], rot: angOf(t.dir[0], t.dir[1]), st });
      // pedestals and their fillers, in the order the specification lists them
      const peds = mine.filter(l => l.cat === 'Storage' && !/filler/.test(l.pid)), fillers = mine.filter(l => l.cat === 'Storage' && /filler/.test(l.pid));
      (ws.peds || []).forEach((d, i) => {
        const R4 = E.pedRect(P, ws, g, d); const pr = angOf(R4[1][0] - R4[0][0], R4[1][1] - R4[0][1]); const lp = R4.map(p => rot2(-pr, p[0] - R4[0][0], p[1] - R4[0][1]));
        const cfg = ((peds[i] && peds[i].desc) || '').match(/((?:box|file)(?:\/(?:box|file))+)/i); const lbl = cfg ? cfg[1].split('/').map(s => s[0].toUpperCase()).join('') : '';
        const mx = lp.reduce((s, p) => s + p[0], 0) / 4, my = lp.reduce((s, p) => s + p[1], 0) / 4;
        if (peds[i]) place(peds[i], shapeBlock(peds[i].style, 'PED' + sigOf(lp), 'A-FURN-3-PEDS', lp, { pos: [mx, my], align: [mx, my], h: 2.4, style: 'Standard' }), R4[0][0], R4[0][1], pr, lbl, { CAPALIAS1: st });
        if (fillers[i]) { const bk = [(R4[0][0] + R4[1][0]) / 2, (R4[0][1] + R4[1][1]) / 2]; place(fillers[i], pointBlock(fillers[i].style), bk[0], bk[1], 0, '', { CAPALIAS1: st }); }
      });
      // anything else specified for this worksurface (extra supports, packs) sits at its middle
      const units = []; for (const l of mine) for (let i = 0; i < left.get(l); i++) units.push(l);
      const mid = g._mid || [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length];
      units.forEach((l, i) => place(l, pointBlock(l.style), mid[0] + 3 * i, mid[1] + 3, 0, '', { CAPALIAS1: st }));
    }
    // project-level lines: side bracket pairs on the first bracket positions, tie plate packs on the first seams, the rest in a job row
    for (const pd of pending) { const l = (bySrc.project || []).find(x => x.cat === 'Supports' && pd.rx.test(x.pid) && left.get(x)); if (l) place(l, pd.bname(l.style), pd.x, pd.y, pd.rot, pd.tag, { CAPALIAS1: pd.st }); }
    for (const t of tiePts) { const l = (bySrc.project || []).find(x => /tie-plate/.test(x.pid) && left.get(x)); if (!l) break; place(l, block(l.style, 'TIE', b => { sq(b, 'A-FURN-P-WKSF-SUP', rect(-1.875, -0.375, 1.875, 0.375)); partAttdefs(b, 'A-FURN-P-WKSF-SUP-T'); }), t.x, t.y, t.rot, '', { CAPALIAS1: t.st }); }
    // extents of what is placed so far
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; const ext = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    for (const t of top) ext(t.x, t.y); for (const p of Object.values(P.nodes)) ext(p.x, p.y);
    if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 1; }
    const texts = []; const addText = (t) => { if (!opts.noText) texts.push(t); };
    const rest = []; for (const l of lines) for (let i = 0; i < (left.get(l) || 0); i++) rest.push(l);
    let y = minY - 30;
    if (rest.length) { addText({ t: 'text', layer: 'CAPTAG', p: [minX, y + 6], h: 3, s: 'JOB PARTS (packages, aligners, seals and other parts not tied to one place)' }); rest.forEach((l, i) => place(l, jobBlock(l.style), minX + 4 + (i % 20) * 9, y - 6 - Math.floor(i / 20) * 12, 0, l.style, {}, 'A-FURN')); y -= 12 * Math.ceil(rest.length / 20) + 12; }
    y -= 6; addText({ t: 'text', layer: 'CAPTAG', p: [minX, y], h: 3, s: 'PANEL CONFIGS' });
    for (const c of Object.values(configs)) { y -= 5; addText({ t: 'text', layer: 'CAPTAG', p: [minX, y], h: 2.4, s: c.id + ' ' + c.wd + ': ' + c.title }); }
    y -= 8; addText({ t: 'text', layer: 'CAPTAG', p: [minX, y], h: 3, s: `${P.name || 'Untitled'} - Steelcase Answer ${P.trim} trim - Answer Panel Planner ${opts.build || ''} - inches - parts from the specification (CAPPN = style number)` });
    for (const t of top) ext(t.x, t.y); for (const t of texts) ext(t.p[0], t.p[1]); ext(minX + 300, y);
    // ---------- write ----------
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, ver); out.push(CAPDXF_TPL.header);
    const jd = Date.now() / 86400000 + 2440587.5; const guid = () => '{' + 'XXXXXXXX-XXXX-4XXX-XXXX-XXXXXXXXXXXX'.replace(/X/g, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]) + '}';
    w(9, '$EXTMIN'); w(10, num(minX - 24)); w(20, num(minY - 24)); w(30, '0.0'); w(9, '$EXTMAX'); w(10, num(maxX + 24)); w(20, num(maxY + 24)); w(30, '0.0');
    w(9, '$LIMMIN'); w(10, '0.0'); w(20, '0.0'); w(9, '$LIMMAX'); w(10, '12.0'); w(20, '9.0');
    w(9, '$TDCREATE'); w(40, num(jd)); w(9, '$TDUCREATE'); w(40, num(jd)); w(9, '$TDUPDATE'); w(40, num(jd)); w(9, '$TDUUPDATE'); w(40, num(jd));
    w(9, '$FINGERPRINTGUID'); w(2, guid()); w(9, '$VERSIONGUID'); w(2, guid());
    const seedAt = out.length; w(9, '$HANDSEED'); w(5, 'FFFF'); w(0, 'ENDSEC');
    out.push(CAPDXF_TPL.classes);
    w(0, 'SECTION'); w(2, 'TABLES'); out.push(CAPDXF_TPL.vport, CAPDXF_TPL.ltype);
    const layerList = [...layers]; w(0, 'TABLE'); w(2, 'LAYER'); w(5, '1'); w(330, '0'); w(100, 'AcDbSymbolTable'); w(70, layerList.length);
    for (const l of layerList) { w(0, 'LAYER'); w(5, H()); w(330, '1'); w(100, 'AcDbSymbolTableRecord'); w(100, 'AcDbLayerTableRecord'); w(2, l); w(70, 0); w(62, LAYER_COLOR[l] || (/^A-FURN-P-PNLS-\d+(-T)?$/.test(l) ? 3 : 7)); w(6, 'Continuous'); if (l === 'Defpoints') w(290, 0); w(370, -3); w(390, '13'); }
    w(0, 'ENDTAB'); out.push(CAPDXF_TPL.style, CAPDXF_TPL.view, CAPDXF_TPL.ucs, CAPDXF_TPL.appid, CAPDXF_TPL.dimstyle);
    w(0, 'TABLE'); w(2, 'BLOCK_RECORD'); w(5, '9'); w(330, '0'); w(100, 'AcDbSymbolTable'); w(70, blocks.length + 2);
    const brec = (h, name, lay) => { w(0, 'BLOCK_RECORD'); w(5, h); w(330, '9'); w(100, 'AcDbSymbolTableRecord'); w(100, 'AcDbBlockTableRecord'); w(2, name); w(340, lay); };
    brec('17', '*Model_Space', '1A'); brec('1B', '*Paper_Space', '1E'); for (const b of blocks) brec(b.rec, b.name, '0');
    w(0, 'ENDTAB'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'BLOCKS');
    const fixedBlock = (hb, he, rec, name) => { w(0, 'BLOCK'); w(5, hb); w(330, rec); w(100, 'AcDbEntity'); w(8, '0'); w(100, 'AcDbBlockBegin'); w(2, name); w(70, 0); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(3, name); w(1, ''); w(0, 'ENDBLK'); w(5, he); w(330, rec); w(100, 'AcDbEntity'); w(8, '0'); w(100, 'AcDbBlockEnd'); };
    fixedBlock('18', '19', '17', '*Model_Space'); fixedBlock('1C', '1D', '1B', '*Paper_Space');
    for (const b of blocks) {
      w(0, 'BLOCK'); w(5, H()); w(330, b.rec); w(100, 'AcDbEntity'); w(8, '0'); w(100, 'AcDbBlockBegin'); w(2, b.name); w(70, b.attdefs.length ? 2 : 0); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(3, b.name); w(1, '');
      for (const g of b.geom) writeGeom(g, b.rec); for (const i of b.inserts) writeInsert(i, b.rec); for (const a of b.attdefs) writeAttdef(a, b.rec);
      w(0, 'ENDBLK'); w(5, H()); w(330, b.rec); w(100, 'AcDbEntity'); w(8, '0'); w(100, 'AcDbBlockEnd');
    }
    w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES'); for (const t of top) writeInsert(t, MSP); for (const t of texts) writeGeom(t, MSP); w(0, 'ENDSEC');
    out.push(CAPDXF_TPL.objects); w(0, 'EOF');
    out[seedAt + 3] = (hseed + 16).toString(16).toUpperCase();
    return out.join('\n') + '\n';
  };
  E.capDxfBlocks = () => '3_<name> polyface meshes beside every P_<name> block, from the guide dimensions (see cap/NOTES.md)';
  if (!isNode) root.ANSWER = E; else module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
