// AdinmoCompatibility.cs
﻿











#if UNITY_IOS

#endif

namespace Adinmo
{
    class AdinmoCompatibility : MonoBehaviour
    {
        private static string PURCHASE_SYMBOL_V4 = "ADINMO_UNITY_STORE_V4";
        private static string PURCHASE_SYMBOL_V5 = "ADINMO_UNITY_STORE_V5";
        // Prevent dead-stripping
        function KeepStrippedSymbols()
        {
            UnityWebRequest r = new UnityWebRequest();
#if UNITY_2017_2_OR_NEWER
            r.SendWebRequest();
#else
            r.Send();
#endif
        }


        [PostProcessBuildAttribute(1)]
        function OnPostprocessBuild(BuildTarget target, string path)
        {

            string destination;
            if (Application.platform == RuntimePlatform.WindowsEditor) //If on windows
                destination = Path.GetDirectoryName(path) + @"\" + PlayerSettings.productName + "_Data" + @"\Adinmo\Plugins\Cef";
            else //If on mac
                destination = Path.GetDirectoryName(path) + @"/" + PlayerSettings.productName + "_Data" + @"/Adinmo/Plugins/Cef";

            if (target == BuildTarget.StandaloneWindows64) //Deploy Cef for Windows 64
            {
                //If a adinmo plugins folder doesnt exist
                if (!Directory.Exists(destination))
                    Directory.CreateDirectory(destination);

                string character = @"\";
                if (Application.platform != RuntimePlatform.WindowsEditor)
                    character = "/";

                string[] files;
                if (Application.platform == RuntimePlatform.WindowsEditor) //If on Windows
                    files = Directory.GetFiles(Application.dataPath + @"\Adinmo\Plugins\Cef Windows x64");
                else //If on mac
                    files = Directory.GetFiles(Application.dataPath + @"/Adinmo/Plugins/Cef Windows x64");

                foreach (string file in files)
                {
                    if (!file.Contains("meta") && !file.Contains("debug"))
                    {

                        if (!File.Exists(destination + @"\" + Path.GetFileName(file)))
                        {
                            if (Application.platform == RuntimePlatform.WindowsEditor)
                                FileUtil.CopyFileOrDirectory(file, destination + character + Path.GetFileName(file));
                            else
                                FileUtil.CopyFileOrDirectory(file, destination + character + Path.GetFileName(file));
                        }
                    }
                }

                if (Application.platform == RuntimePlatform.WindowsEditor)
                    Directory.CreateDirectory(destination + @"\locales");
                else
                    Directory.CreateDirectory(destination + @"/locales");

                if (Application.platform == RuntimePlatform.WindowsEditor) //If on Windows
                    files = Directory.GetFiles(Application.dataPath + @"\Adinmo\Plugins\Cef Windows x64\locales");
                else //If on mac
                    files = Directory.GetFiles(Application.dataPath + @"/Adinmo/Plugins/Cef Windows x64/locales");

                foreach (string file in files)
                {
                    if (!file.Contains("meta"))
                    {
                        if (Application.platform == RuntimePlatform.WindowsEditor)
                        {
                            if (!File.Exists(destination + @"\locales\" + Path.GetFileName(file)))
                                FileUtil.CopyFileOrDirectory(file, destination + @"\locales\" + Path.GetFileName(file));
                        }
                        else
                        {
                            if (!File.Exists(destination + @"/locales/" + Path.GetFileName(file)))
                                FileUtil.CopyFileOrDirectory(file, destination + @"/locales/" + Path.GetFileName(file));
                        }
                    }
                }
            }
            else if (target != BuildTarget.Android && target != BuildTarget.iOS && target != BuildTarget.WebGL) //If not on Android or iOS which dont need any additional deployment
                Debug.LogError("AdInMo does not support this build target:" + target + ".");



            if (target == BuildTarget.iOS)
            {
                AddPListValues(path);
            }

        }


        // Implement a function to read and write values to the plist file:
        static void AddPListValues(string pathToXcode)
        {
#if UNITY_IOS
        
            string iosCode = AdinmoEditorCommon.getiOSCode();
            if (!string.IsNullOrEmpty(iosCode))
            {
                // Retrieve the plist file from the Xcode project directory:
                string plistPath = pathToXcode + "/Info.plist";
                PlistDocument plistObj = new PlistDocument();


                // Read the values from the plist file:
                plistObj.ReadFromString(File.ReadAllText(plistPath));

                // Set values from the root object:
                PlistElementDict plistRoot = plistObj.root;




                // Set the description key-value in the plist:
                plistRoot.SetString("GADApplicationIdentifier", iosCode);

                // Save changes to the plist:
                File.WriteAllText(plistPath, plistObj.WriteToString());
            }

#endif
        }


        [InitializeOnLoadMethod]
        private static void SetupUnityStore()
        {
            var listRequest = Client.List(true);
            while (!listRequest.IsCompleted)
                Thread.Sleep(100);

            if (listRequest.Error != null)
            {
                Debug.Log("Error: " + listRequest.Error.message);
                return;
            }

            var packages = listRequest.Result;
            string version=null;
            foreach (var package in packages)
            {
                if (package.source == PackageSource.Registry)
                {
                    if (package.name == "com.unity.purchasing" )
                    {
                        int versionNo = GetVersionNo(package.version);
                        if (versionNo >= 5000000)
                        {
                            version = PURCHASE_SYMBOL_V5;
                        }
                        else if (versionNo >= 4000000)
                        {
                            version = PURCHASE_SYMBOL_V4;
                        }
                            
                    }
                }
            }
            NamedBuildTarget bt = NamedBuildTarget.FromBuildTargetGroup(EditorUserBuildSettings.selectedBuildTargetGroup);
            string symbols = PlayerSettings.GetScriptingDefineSymbols(bt);
            
            if (symbols.Contains(PURCHASE_SYMBOL_V4) && (version is null || version == PURCHASE_SYMBOL_V5))
            {
                RemoveDefine(PURCHASE_SYMBOL_V4);
            }
            if (symbols.Contains(PURCHASE_SYMBOL_V5) && (version is null || version == PURCHASE_SYMBOL_V4))
            {
                RemoveDefine(PURCHASE_SYMBOL_V5);
            }
            if(version !=null && !symbols.Contains(version))
                AddDefine(version);
        }

        static int GetVersionNo(string version)
        {
            string[] split=version.Split('.');

            int res = 0;
            if (split.Length > 0)
            {
                res = int.Parse(split[0]) * 1000000;
            }
            if (split.Length > 1)
            {
                res += int.Parse(split[1]) * 1000;
            }
            if (split.Length > 2)
            {
                res += int.Parse(split[2]);
            }
            return res;

        }

        function AddDefine(string def)
        {
            NamedBuildTarget bt = NamedBuildTarget.FromBuildTargetGroup(EditorUserBuildSettings.selectedBuildTargetGroup);
            string symbols = PlayerSettings.GetScriptingDefineSymbols(bt);

            StringBuilder sb = new();
            sb.Append(symbols);

            if (sb.Length == 0) sb.Append(def + ";");
            else sb.Append($"{(sb[^1] == ';' ? "" : ";")}{def}");

            PlayerSettings.SetScriptingDefineSymbols(bt, sb.ToString());
        }
        function RemoveDefine(string def)
        {
            NamedBuildTarget bt = NamedBuildTarget.FromBuildTargetGroup(EditorUserBuildSettings.selectedBuildTargetGroup);
            string symbols = PlayerSettings.GetScriptingDefineSymbols(bt);
            PlayerSettings.SetScriptingDefineSymbols(bt, symbols.Replace(def, ""));
        }
    }


    class AdinmoPreProcessor : IPreprocessBuildWithReport
    {
        public int callbackOrder { get { return 0; } }
        function OnPreprocessBuild(BuildReport report)
        {
#if UNITY_IOS
            string iosCode = AdinmoEditorCommon.getiOSCode();
            if(!string.IsNullOrEmpty(iosCode))
            {
                string symbols=PlayerSettings.GetScriptingDefineSymbolsForGroup(BuildTargetGroup.iOS);
                if (string.IsNullOrEmpty(symbols))
                {
                    symbols = "ADINMO_UMP_IOS";
                }
                else if (!symbols.Contains("ADINMO_UMP_IOS"))
                {
                    symbols+=";ADINMO_UMP_IOS";
                }
                PlayerSettings.SetScriptingDefineSymbolsForGroup(BuildTargetGroup.iOS, symbols);
            }
            else
            {
                string symbols = PlayerSettings.GetScriptingDefineSymbolsForGroup(BuildTargetGroup.iOS);
                
                if(!string.IsNullOrEmpty(symbols) && symbols.Contains("ADINMO_UMP_IOS"))
                {
                    symbols = symbols.Replace(";ADINMO_UMP_IOS", "");
                    symbols = symbols.Replace("ADINMO_UMP_IOS", "");

                }
                PlayerSettings.SetScriptingDefineSymbolsForGroup(BuildTargetGroup.iOS, symbols);
            }
#endif
        }
    }
}


// AdinmoEditor.cs
﻿








namespace Adinmo
{
    class AdinmoPlacementTreeViewItem : TreeViewItem
    {
        public AdinmoPlacementTreeViewItem(int id, int depth, string displayName) : base(id, depth, displayName)
        {
        }

        public ImpressionsSummary GetImpressionsSummary()
        {
            return AdinmoManager.Sampler.GetImpressionsSummary(displayName);
        }

        public Placement GetPlacement()
        {
            return AdinmoManager.Downloader.GetPlacement(displayName);
        }
    }

    class AdinmoReplaceTreeViewItem : TreeViewItem
    {
        public AdinmoReplace m_adinmoReplace;

        public AdinmoReplaceTreeViewItem(int id, int depth, AdinmoReplace adinmoReplace) : base(id, depth, adinmoReplace.name)
        {
            m_adinmoReplace = adinmoReplace;
        }
    }

    class AdinmoPlacementTreeView : TreeView
    {
        const int LABEL_WIDTH = 170;
        const int VALUE_WIDTH = 75;
        Texture2D greyTexture;

        public AdinmoPlacementTreeView(TreeViewState state, string editorScriptPath) : base(state)
        {
            greyTexture = (Texture2D)AssetDatabase.LoadAssetAtPath(editorScriptPath + "/Textures/greytexture.png", typeof(Texture2D));
            Reload();
        }

        protected override TreeViewItem BuildRoot()
        {
            AdinmoReplace[] adinmoReplacements = (AdinmoReplace[])GameObject.FindObjectsOfType(typeof(AdinmoReplace));
            Dictionary<string, List<AdinmoReplace>> placementsDictionary = new Dictionary<string, List<AdinmoReplace>>();
            foreach (AdinmoReplace adinmoReplace in adinmoReplacements)
            {
                if (!placementsDictionary.ContainsKey(adinmoReplace.m_placementKey))
                {
                    placementsDictionary.Add(adinmoReplace.m_placementKey, new List<AdinmoReplace>());
                }
                placementsDictionary[adinmoReplace.m_placementKey].Add(adinmoReplace);
            }
            int currentId = 0;
            if (placementsDictionary.Count == 0)
            {
                var tempRoot = new TreeViewItem { id = currentId++, depth = -1, displayName = "Root" };
                var info = new TreeViewItem { id = currentId++, depth = 0, displayName = "" };
                tempRoot.AddChild(info);
                return tempRoot;
            }
            var root = new TreeViewItem { id = currentId++, depth = -1, displayName = "Root" };
            foreach (KeyValuePair<string, List<AdinmoReplace>> entry in placementsDictionary)
            {
                TreeViewItem placement = null;
                if (Application.isPlaying)
                {
                    placement = new AdinmoPlacementTreeViewItem(currentId++, 0, entry.Key);
                }
                else
                {
                    placement = new TreeViewItem(currentId++, 0, entry.Key);
                }
                root.AddChild(placement);
                foreach (AdinmoReplace adinmoReplace in entry.Value)
                {
                    var adinmoReplaceItem = new TreeViewItem(currentId++, 1, adinmoReplace.name);
                    placement.AddChild(adinmoReplaceItem);
                    if (Application.isPlaying)
                    {
                        var childItem = new AdinmoReplaceTreeViewItem(currentId++, 2, adinmoReplace);
                        adinmoReplaceItem.AddChild(childItem);
                    }
                }
            }
            return root;
        }

        protected override float GetCustomRowHeight(int rowno, TreeViewItem item)
        {
            if (item is AdinmoReplaceTreeViewItem)
            {
                if (((AdinmoReplaceTreeViewItem)item).m_adinmoReplace.GetObjectType() == AdinmoReplace.ObjectType.Image || !AdinmoManager.s_manager.imageRenderDebug)
                {
                    return base.GetCustomRowHeight(rowno, item);
                }
                else
                {
                    return 50;
                }
            }
            else if (item is AdinmoPlacementTreeViewItem)
            {
                if (Application.isPlaying && IsExpanded(item.id))
                {
                    Placement placement = null;
                    if (AdinmoManager.Downloader)
                        placement = AdinmoManager.Downloader.GetPlacement(item.displayName);
                    if (placement == null)
                        return rowHeight * 3;
                    else
                        return rowHeight * 7 + 5;
                }
                else
                    return base.GetCustomRowHeight(rowno, item);
            }
            else
            {
                return base.GetCustomRowHeight(rowno, item);
            }
        }

        protected override void RowGUI(RowGUIArgs args)
        {
            GUIStyle headerStyle = new GUIStyle(GUI.skin.label)
            {
                alignment = TextAnchor.UpperLeft,
                fontStyle = FontStyle.Bold
            };
            GUIStyle labelStyle = new GUIStyle(GUI.skin.label)
            {
                alignment = TextAnchor.UpperLeft
            };
            GUIStyle valueStyle = new GUIStyle(GUI.skin.label)
            {
                alignment = TextAnchor.UpperRight
            };
            if (Application.isPlaying)
            {
                if (args.item is AdinmoReplaceTreeViewItem)
                {

                    AdinmoReplace adinmoReplace = ((AdinmoReplaceTreeViewItem)args.item).m_adinmoReplace;
                    if (adinmoReplace.SampleTexture)
                    {
                        Rect rect = args.rowRect;
                        rect.x += GetFoldoutIndent(args.item);
                        rect.width = 350;
                        if (adinmoReplace.GetObjectType() == AdinmoReplace.ObjectType.Image || !AdinmoManager.s_manager.imageRenderDebug)
                        {
                            string str = "Latest Sample: " + (adinmoReplace.LatestSample.sample * 100).ToString("F2") + "%";
                            Color oldColour = GUI.contentColor;
                            if (adinmoReplace.LatestFailureReason != "None")
                            {
                                str = str + " " + adinmoReplace.LatestFailureReason;
                                var textDimensions = GUI.skin.label.CalcSize(new GUIContent(str));
                                GUI.contentColor = new Color(0, 0, 0, 0.75f);
                                rect.width = textDimensions.x + 5;
                                GUI.Label(new Rect(rect.x + 1, rect.y + 1, rect.width, rect.height), str);
                                GUI.contentColor = Color.red;
                                GUI.Label(rect, str);
                            }
                            else
                                GUI.Label(rect, str);
                            GUI.contentColor = oldColour;
                        }
                        else
                        {
                            float imageWidth = 0;
                            float imageHeight = 0;
                            float widthOffset = 0;
                            float heightOffset = 0;

                            if (adinmoReplace.SampleTexture.width > adinmoReplace.SampleTexture.height)
                            {
                                imageWidth = 48;
                                imageHeight = (adinmoReplace.SampleTexture.height * 48.0f) / adinmoReplace.SampleTexture.width;
                                heightOffset = (48 - imageHeight) / 2;
                            }
                            else
                            {
                                imageWidth = (adinmoReplace.SampleTexture.width * 48.0f) / adinmoReplace.SampleTexture.height;
                                imageHeight = 48;
                                widthOffset = (48 - imageWidth) / 2;
                            }
                            GUI.DrawTexture(new Rect(rect.x, rect.y, 48, 48), greyTexture);
                            GUI.DrawTexture(new Rect(rect.x + widthOffset, rect.y + heightOffset, imageWidth, imageHeight), adinmoReplace.SampleTexture);
                            GUI.Label(new Rect(rect.x + 55, rect.y + 5, 150, 16), "Latest Sample: " + (adinmoReplace.LatestSample.sample * 100).ToString("F2") + "%");
                            if (adinmoReplace.LatestFailureReason != "None")
                            {
                                string failReasonStr = "Fail Reason: " + adinmoReplace.LatestFailureReason;
                                var textDimensions = GUI.skin.label.CalcSize(new GUIContent(failReasonStr));
                                Color oldColour = GUI.contentColor;
                                GUI.contentColor = new Color(0, 0, 0, 0.75f);
                                GUI.Label(new Rect(rect.x + 56, rect.y + 22, textDimensions.x + 5, 16), failReasonStr);
                                GUI.contentColor = Color.red;
                                GUI.Label(new Rect(rect.x + 55, rect.y + 21, textDimensions.x + 5, 16), failReasonStr);
                                GUI.contentColor = oldColour;
                            }
                        }
                        //GUI.Label(rect,"Latest Sample");
                    }
                }
                else if (args.item is AdinmoPlacementTreeViewItem)
                {

                    // base.RowGUI(args);
                    Rect rect = args.rowRect;
                    rect.x += GetContentIndent(args.item);
                    if (IsExpanded(args.item.id))
                    {

                        GUI.Label(rect, args.item.displayName, headerStyle);
                        ImpressionsSummary impressionsSummary = ((AdinmoPlacementTreeViewItem)args.item).GetImpressionsSummary();
                        Placement placement = ((AdinmoPlacementTreeViewItem)args.item).GetPlacement();
                        float bestSample = 0;
                        foreach (TreeViewItem replaceItem in args.item.children)
                        {
                            bestSample = Mathf.Max(bestSample,((AdinmoReplaceTreeViewItem)replaceItem.children[0]).m_adinmoReplace.LatestSample.sample);
                        }

                        string currentNumImpressions = " n/a";
                        string pCSamplesRemaining = " n/a";
                        if (impressionsSummary.CurrentImageValid)
                        {
                            currentNumImpressions = string.Format("{0} / {1}", impressionsSummary.CurrentNumberImpressions, (impressionsSummary.CurrentNumberImpressions + impressionsSummary.CurrentNumberFailedImpressions));
                            pCSamplesRemaining = (impressionsSummary.PCSamplesRemaining * 100).ToString("F1");
                        }
                        float rowposy = rect.y + rowHeight;

                        if (placement != null)
                        {
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH + VALUE_WIDTH, rowHeight), "Name:    " + placement.name, headerStyle);
                            rowposy += rowHeight + 3;
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH, rowHeight), "Aspect Ratio:", labelStyle);
                            if (placement != null)
                            {
                                string aspectRatioText = placement.AspectRatioString;
                                GUI.Label(new Rect(rect.x + LABEL_WIDTH, rowposy, VALUE_WIDTH, rowHeight), aspectRatioText, valueStyle);
                            }
                            rowposy += rowHeight;
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH, rowHeight), "Samples Countdown:", labelStyle);
                            GUI.Label(new Rect(rect.x + LABEL_WIDTH, rowposy, VALUE_WIDTH, rowHeight), pCSamplesRemaining, valueStyle);
                            rowposy += rowHeight;
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH, rowHeight), "Impressions Current Image:", labelStyle);
                            GUI.Label(new Rect(rect.x + LABEL_WIDTH, rowposy, VALUE_WIDTH, rowHeight), currentNumImpressions, valueStyle);
                            rowposy += rowHeight;
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH, rowHeight), "Impressions Total:", labelStyle);
                            GUI.Label(new Rect(rect.x + LABEL_WIDTH, rowposy, VALUE_WIDTH, rowHeight), string.Format("{0} / {1}", impressionsSummary.TotalNumberImpressions, (impressionsSummary.TotalNumberImpressions + impressionsSummary.TotalNumberFailedImpressions)), valueStyle);
                            rowposy += rowHeight;
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH, rowHeight), "Best Sample:", labelStyle);
                            GUI.Label(new Rect(rect.x + LABEL_WIDTH, rowposy, VALUE_WIDTH, rowHeight), (bestSample * 100).ToString("F1"), valueStyle);
                            GUI.Label(new Rect(rect.x + LABEL_WIDTH + VALUE_WIDTH, rowposy, LABEL_WIDTH, rowHeight), "%", labelStyle);
                        }
                        else if (AdinmoManager.IsReady())
                        {
                            Color oldColour = GUI.contentColor;
                            string str1 = "Placement Key is invalid or paused on";
                            string str2 = "Adinmo.com for this Game Key";

                            GUI.contentColor = new Color(0, 0, 0, 0.75f);
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH + VALUE_WIDTH + 20, rowHeight), str1, headerStyle);
                            GUI.Label(new Rect(rect.x, rowposy + rowHeight, LABEL_WIDTH + VALUE_WIDTH + 20, rowHeight), str2, headerStyle);

                            GUI.contentColor = Color.red;
                            GUI.Label(new Rect(rect.x, rowposy, LABEL_WIDTH + VALUE_WIDTH + 20, rowHeight), str1, headerStyle);
                            GUI.Label(new Rect(rect.x, rowposy + rowHeight, LABEL_WIDTH + VALUE_WIDTH + 20, rowHeight), str2, headerStyle);
                            GUI.contentColor = oldColour;
                        }



                    }
                    else
                    {
                        GUI.Label(rect, args.item.displayName, headerStyle);
                    }
                }
                else
                {
                    base.RowGUI(args);
                }
            }
            else if (args.item is AdinmoPlacementTreeViewItem)
            {
                Rect rect = args.rowRect;
                rect.x += GetContentIndent(args.item);
                GUI.Label(rect, args.item.displayName, headerStyle);
            }
            else
            {
                base.RowGUI(args);
            }
        }

        protected override void DoubleClickedItem(int id)
        {
            base.DoubleClickedItem(id);
            TreeViewItem item = FindItem(id, rootItem);
            if (item.depth == 1)
            {
                GameObject foundObj = GameObject.Find(item.displayName);
                Selection.activeGameObject = foundObj;
            }
        }
    }

    internal static class AdinmoEditorCommon //Common editor code that can be reused
    {
        function RenderAdinmoManagerUI(SerializedObject serializedObject, Texture2D AdinmoLogo, ref Rect rect, bool isPopOutWindow,string editorScriptPath)
        {
            //Retrieve all the variables required from the Adinmo Manager
            var debug = serializedObject.FindProperty("basicDebug");
            var showAdvancedDebug = serializedObject.FindProperty("showAdvancedDebug");
            var debugOnDevice = serializedObject.FindProperty("m_debugOnDevice");
            var placementDebug = serializedObject.FindProperty("placementDebug");
            var debugSize = serializedObject.FindProperty("debugFontSize");
            var debugColour = serializedObject.FindProperty("debugFontColour");
            var imageRenderDebug = serializedObject.FindProperty("imageRenderDebug");
            var applyAds = serializedObject.FindProperty("m_applyAds");
            var camera = serializedObject.FindProperty("m_camera");
            var gamekey = serializedObject.FindProperty("m_gameKey");
            var applicationVersion = serializedObject.FindProperty("applicationVersion");
            var androidAdmobAppId= serializedObject.FindProperty("m_AndroidAdMobAppId");
            var magnifierSortOrder = serializedObject.FindProperty("MagnifierSortOrder");
            if (isPopOutWindow) //Specific formatting for the popout window
            {
                EditorGUILayout.Space();
                EditorGUIUtility.labelWidth = 180;
                EditorGUILayout.BeginVertical();
                EditorGUILayout.BeginHorizontal(GUILayout.Height(AdinmoLogo.height));
                EditorGUILayout.PrefixLabel("  ");
            }
            //Render the Adinmo Logo
            rect = EditorGUILayout.GetControlRect();
            rect.height = AdinmoLogo.height;
            rect.width = AdinmoLogo.width;
            if (isPopOutWindow)
                rect.x = rect.x - (AdinmoLogo.width / 2) - 20;
            GUI.DrawTexture(rect, AdinmoLogo, ScaleMode.ScaleToFit);

            if (isPopOutWindow) //Specific formatting for the popout window
                EditorGUILayout.EndHorizontal();
            else //Specific formatting for the inspector script
            {
                for (int i = 0; i < 6; i++)
                    EditorGUILayout.Space();
                serializedObject.Update();
            }

            //Display the AdinmoManager debug options
            EditorGUILayout.PropertyField(debug);
            if (debug.boolValue)
            {
                EditorGUILayout.PropertyField(debugOnDevice);
                string buttonText = "Show Advanced Debug Config";
                if (showAdvancedDebug.boolValue) { buttonText = "Hide Advanced Debug Config"; }
                if (GUILayout.Button(buttonText))
                    showAdvancedDebug.boolValue = !showAdvancedDebug.boolValue;
                if (showAdvancedDebug.boolValue)
                {
                    EditorGUILayout.PropertyField(placementDebug);
                    EditorGUILayout.PropertyField(debugSize);
                    EditorGUILayout.PropertyField(imageRenderDebug);
                }
            }

            //Display the general AdinmoManager configuration properties
            EditorGUILayout.PropertyField(applyAds);
            EditorGUILayout.PropertyField(camera);
            EditorGUILayout.PropertyField(gamekey);
            EditorGUILayout.PropertyField(applicationVersion);
            EditorGUILayout.PropertyField(androidAdmobAppId);
            EditorGUILayout.PropertyField(magnifierSortOrder);
            
            string newiOSAdMobAppId = EditorGUI.TextField(EditorGUILayout.GetControlRect(), "iOS Ad Mob App Id",AdinmoManager.m_iOSAdMobAppId);
            List<string> labels = new List<string>();
            int clickDisplayMask = 0;
            int currentLayerMask = serializedObject.FindProperty("clickLayerMask").intValue;
            for (int i = 0; i < 32; i++)
            {
                if (LayerMask.LayerToName(i) != "")
                {
                    int tempMask = 1 << labels.Count;
                    labels.Add(LayerMask.LayerToName(i));
                    if ((1 << i & currentLayerMask) != 0)
                        clickDisplayMask |= tempMask;

                }
            }

            if (labels.Count > 0)
            {
                int newclickDisplaymask = EditorGUILayout.MaskField("Click ignores Layers", clickDisplayMask, labels.ToArray());
                if (newclickDisplaymask != -1 && newclickDisplaymask != clickDisplayMask)
                {
                    int newClickMask = 0;
                    for (int i = 0; i < labels.Count; i++)
                    {
                        if ((newclickDisplaymask & 1 << i) != 0)
                        {
                            newClickMask |= 1 << LayerMask.NameToLayer(labels[i]);
                        }
                    }

                    serializedObject.FindProperty("clickLayerMask").intValue = newClickMask;
                }
                else if (newclickDisplaymask == -1)
                {
                    Debug.LogError("Can't filter out all layers");
                }
            }

                //Apply the visual changes to properties
            bool changed = serializedObject.ApplyModifiedProperties();
            if(newiOSAdMobAppId!=AdinmoManager.m_iOSAdMobAppId)
            {
                if (!string.IsNullOrEmpty(newiOSAdMobAppId))
                {
                    Directory.CreateDirectory(Application.dataPath + "/AdinmoData");
                    StreamWriter writer = new StreamWriter(Application.dataPath + "/AdinmoData/iosUMPCode.txt", false);
                    writer.Write(newiOSAdMobAppId);
                    writer.Close();
                    
                }
                else if (File.Exists(Application.dataPath + "/AdinmoData/iosUMPCode.txt"))
                {
                    File.Delete(Application.dataPath + "/AdinmoData/iosUMPCode.txt");
                }
                AdinmoManager.m_iOSAdMobAppId = newiOSAdMobAppId;
            }
        }

        public static string getEditorScriptPath()
        {
            var guid = AssetDatabase.FindAssets($"t:Script {nameof(AdinmoEditor)}")[0];
            var path = AssetDatabase.GUIDToAssetPath(guid);
            return path.Substring(0, path.LastIndexOf("/"));
        }

        public static string getiOSCode()
        {
            string iosCode = null;
            try
            {
                StreamReader reader = new StreamReader(Application.dataPath + "/AdinmoData/iosUMPCode.txt");
                iosCode = reader.ReadToEnd();
                reader.Close();
            }
            catch (Exception)
            {

            }
            return iosCode;
        }
    }

    [InitializeOnLoad]
    class AdinmoEditor : EditorWindow
    {
        private Texture2D AdinmoLogo;
        private TreeViewState m_TreeViewState;
        private AdinmoPlacementTreeView placementTreeView;
        private Vector2 scrollPos;
        private bool m_gameRunning;
        private bool m_gameReady;
        private bool m_debugImageRender;
        private static string currentScene;
        // Add menu named "My Window" to the Window menu
        [MenuItem("Tools/Adinmo/Manager")]
        static void Init()
        {
            // Get existing open window or if none, make a new one:
            AdinmoEditor window = (AdinmoEditor)EditorWindow.GetWindow(typeof(AdinmoEditor));
            window.Show();
        }

        static AdinmoEditor()
        {
            EditorApplication.playModeStateChanged += LogPlayModeState;
        }

        private static void LogPlayModeState(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode && Application.isEditor)
            {
                try
                {
                    int unityVersion = 0;
                    int.TryParse(Application.unityVersion.Substring(0, 4), out unityVersion);
                    if (EditorUserBuildSettings.activeBuildTarget == BuildTarget.Android && PlayerSettings.GetGraphicsAPIs(BuildTarget.Android)[0] == UnityEngine.Rendering.GraphicsDeviceType.Vulkan && unityVersion < 2019)
                    {
                        Debug.LogWarning("Vulkan support for Android in Adinmo only fully implemented for Unity 2019 and above");
                    }
                }
                catch (System.Exception) { }
            }
        }

        private void OnEnable()
        {
            MonoScript ms = MonoScript.FromScriptableObject(this);
            string editorScriptPath = AssetDatabase.GetAssetPath(ms);
            editorScriptPath = editorScriptPath.Substring(0, editorScriptPath.LastIndexOf("/"));
            AdinmoLogo = (Texture2D)AssetDatabase.LoadAssetAtPath(editorScriptPath + "/Textures/AdinMoLogo.png", typeof(Texture2D));
            Texture2D AdinmoIcon = (Texture2D)AssetDatabase.LoadAssetAtPath(editorScriptPath + "/Textures/AdinmoIcon.png", typeof(Texture2D));
            titleContent = new GUIContent("Adinmo", AdinmoIcon);
            if (m_TreeViewState == null)
                m_TreeViewState = new TreeViewState();
            m_gameRunning = Application.isPlaying;
            placementTreeView = new AdinmoPlacementTreeView(m_TreeViewState, editorScriptPath);

            EditorSceneManager.sceneOpened += OnLevelFinishedLoading;
            AdinmoReplace.OnChange += RefreshTree;
        }

        void OnDisable()
        {
            EditorSceneManager.sceneOpened -= OnLevelFinishedLoading;
            AdinmoReplace.OnChange -= RefreshTree;
        }

        void OnLevelFinishedLoading(Scene scene, OpenSceneMode mode)
        {
            RefreshTree(true);
        }

        function RefreshTree(bool recreate)
        {
            if (recreate)
            {
                placementTreeView.Reload();
            }
            else
            {
                placementTreeView.Repaint();
            }
        }

        private void Update()
        {
            if (m_gameRunning != Application.isPlaying || AdinmoManager.IsReady() != m_gameReady || (AdinmoManager.s_manager != null && m_debugImageRender != AdinmoManager.s_manager.imageRenderDebug))
            {
                placementTreeView.Reload();
                m_gameRunning = Application.isPlaying;
                m_gameReady = AdinmoManager.IsReady();
                m_debugImageRender = (AdinmoManager.s_manager != null && AdinmoManager.s_manager.imageRenderDebug);
            }
        }

        void OnGUI() //This controls how the GUI should be rendered in the AdinmoManager Popout Window
        {
            //Retrieve the AdInMo manager
            AdinmoManager adinmoManager = GameObject.FindObjectOfType<AdinmoManager>();
            if (adinmoManager == null)
            {
                EditorGUILayout.LabelField("Can't find an AdinmoManager in Scene");
                return;
            }
            //Render the common AdinmoManagerUI
            var serializedObject = new SerializedObject(adinmoManager);
            Rect rect = new Rect();
            var oldLabelWidth = EditorGUIUtility.labelWidth;
            AdinmoEditorCommon.RenderAdinmoManagerUI(serializedObject, AdinmoLogo, ref rect, true,AdinmoEditorCommon.getEditorScriptPath());
            //Render the UI that is exclusive to the popout window
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Placements in scene", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("A list of placements in the scene. This will also contain impression information at runtime.");
            EditorGUILayout.Space();
            EditorGUILayout.BeginHorizontal();
            rect = EditorGUILayout.GetControlRect(false, GUILayout.ExpandHeight(true));
            placementTreeView.OnGUI(rect);
            EditorGUILayout.EndHorizontal();
            var versionStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.LowerRight, fontSize = 10 };
            EditorGUILayout.LabelField("", "v" + AdinmoSender.GetVersion() + " s" + AdinmoSender.GetSdkSource(), versionStyle);
            EditorGUILayout.EndVertical();
            EditorGUIUtility.labelWidth = oldLabelWidth;
        }
    }
}
// AdInMoIapProxy.cs
// AdInMoIapProxy.cs
// Unity-style extension method for seamless AdInMo IAPBoost integration
// Usage: UnityPurchasing.InitializeWithAdInMo(this, builder);
# if ADINMO_UNITY_STORE_V4





 // from AdInMo SDK

/// <summary>
/// Extension methods for Unity Purchasing to enable AdInMo IAPBoost integration
/// </summary>
public static class UnityPurchasingAdInMoExtensions
{
    /// <summary>
    /// Initialize Unity Purchasing with AdInMo IAPBoost support in a single call
    /// </summary>
    /// <param name="listener">Your IStoreListener implementation</param>
    /// <param name="builder">Unity IAP ConfigurationBuilder</param>
    function InitializeWithAdInMo(IStoreListener listener, ConfigurationBuilder builder)
    {
        AdinmoManager.Sender?.LogInfo("Initializing Unity Purchasing with AdInMo IAPBoost support...");
        AdInMoIapProxy.Register();
        
        // Use newer IDetailedStoreListener API to avoid deprecation warnings
        var wrappedListener = AdInMoIapProxy.Wrap(listener);
        if (wrappedListener is IDetailedStoreListener detailedListener)
        {
            UnityPurchasing.Initialize(detailedListener, builder);
        }
        else
        {
            // Fallback for compatibility
            #pragma warning disable CS0618
            UnityPurchasing.Initialize(wrappedListener, builder);
            #pragma warning restore CS0618
        }
    }


}

/// <summary>
/// Internal proxy that handles AdInMo IAPBoost callbacks and reporting
/// </summary>
internal static class AdInMoIapProxy
{
    /// <summary>
    /// Wraps an IStoreListener with AdInMo reporting capabilities
    /// </summary>
    public static IStoreListener Wrap(IStoreListener inner) => new Proxy(inner);

    /// <summary>
    /// Registers all AdInMo IAPBoost callbacks
    /// </summary>
    function Register()
    {
        if (_registered) return;
        _registered = true;

        AdinmoManager.Sender?.LogInfo("Registering AdInMo IAPBoost callbacks...");

        // 1) When an AdInMo UI/ad requests a purchase, start Unity IAP for that SKU
        AdinmoManager.SetInAppPurchaseCallback(OnAdInMoPurchaseRequested);

        // 2) Let AdInMo show localized store prices in their magnifier CTA
        AdinmoManager.SetInAppPurchaseGetPriceCallback(GetLocalizedPriceString);

        // 3) Let AdInMo know if a non-consumable is already owned (for gating UI/serving)
        // Use boolean callback for maximum compatibility across AdInMo SDK versions
        AdinmoManager.SetInAppPurchasedAlreadyCallback((string iapId) =>
        {
            // Fallback: try to get controller from Unity IAP if proxy wasn't initialized properly
            if (_controller == null)
            {
                TryGetControllerFromUnityIAP();
            }
            
            var product = _controller?.products?.WithID(iapId);
            bool isPurchased = product != null && product.hasReceipt;

            AdinmoManager.Sender?.LogInfo($"Already purchased check for {iapId}: {isPurchased}");
            if(isPurchased)
                return new InAppAlreadyPurchasedReply(true, (float)product.metadata.localizedPrice, product.metadata.isoCurrencyCode);
            return new InAppAlreadyPurchasedReply(false);
        });

        AdinmoManager.Sender?.LogInfo("All callbacks registered successfully!");
    }

    /// <summary>
    /// Validates that all requested product IDs are properly configured in Unity IAP
    /// Call this after IAP initialization for debugging purposes
    /// </summary>
    function ValidateProductConfiguration()
    {
        if (_controller?.products?.all == null)
        {
            AdinmoManager.Sender?.LogWarning("Cannot validate products - IAP not initialized");
            return;
        }

        var registeredProducts = _controller.products.all.Select(p => p.definition.id).ToArray();
        AdinmoManager.Sender?.LogInfo($"Registered Unity IAP Products: [{string.Join(", ", registeredProducts)}]");
        AdinmoManager.Sender?.LogInfo(" Ensure all AdInMo campaign SKU IDs match these product IDs to avoid purchase failures");

        #if UNITY_EDITOR
        AdinmoManager.Sender?.LogInfo("💡 TIP: Check your AdInMo dashboard campaigns and verify all SKU IDs are listed above");
        #endif
    }

    // ---- internal state ----
    static bool _registered;
    static IStoreController _controller;
    
    /// <summary>
    /// Fallback method to get the controller when proxy initialization was bypassed
    /// </summary>
    static void TryGetControllerFromUnityIAP()
    {
        try
        {
            // Try to get the controller from any active StoreHandler instances
            var storeHandlers = UnityEngine.Object.FindObjectsOfType<MonoBehaviour>();
            foreach (var handler in storeHandlers)
            {
                // Look for StoreController field/property in active components
                var storeControllerField = handler.GetType().GetField("StoreController", 
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                
                if (storeControllerField != null)
                {
                    var controller = storeControllerField.GetValue(handler) as IStoreController;
                    if (controller != null)
                    {
                        _controller = controller;
                        AdinmoManager.Sender?.LogInfo("Found and set controller from StoreHandler fallback");
                        return;
                    }
                }
            }

            AdinmoManager.Sender?.LogWarning("Could not find active StoreController via fallback method");
        }
        catch (Exception ex)
        {
            AdinmoManager.Sender?.LogError($"Error in fallback controller lookup: {ex.Message}");
        }
    }

    // ---- AdInMo callbacks ----

    static void OnAdInMoPurchaseRequested(string iapId)
    {
        AdinmoManager.Sender?.LogInfo($"Purchase requested from AdInMo for: {iapId}");
        
        // Fallback: try to get controller from Unity IAP if proxy wasn't initialized properly
        if (_controller == null)
        {
            TryGetControllerFromUnityIAP();
        }
        
        if (_controller == null) 
        {
            AdinmoManager.Sender?.LogError("Cannot process purchase - IAP not initialized yet");
            ReportPurchaseUnavailable(iapId, "IAP system not initialized");
            return; 
        }

        var product = _controller.products?.WithID(iapId);
        if (product == null)
        {
            AdinmoManager.Sender?.LogError($"Product '{iapId}' not registered in Unity IAP configuration");
            ReportPurchaseUnavailable(iapId, "Product not configured in Unity IAP");
            return;
        }

        if (!product.availableToPurchase)
        {
            AdinmoManager.Sender?.LogWarning($"Product '{iapId}' is not available for purchase");
            ReportPurchaseUnavailable(iapId, "Product not available for purchase", product);
            return;
        }

        AdinmoManager.Sender?.LogInfo($"Starting purchase for: {iapId}");
        _controller.InitiatePurchase(product);
    }

    /// <summary>
    /// Reports to AdInMo that a purchase cannot be completed due to configuration issues
    /// </summary>
    static void ReportPurchaseUnavailable(string iapId, string reason, Product product = null)
    {
        // Extract product metadata if available
        string currency = product?.metadata?.isoCurrencyCode ?? "USD";
        float price = product != null ? (float)(product.metadata?.localizedPrice ?? 0m) : 0f;

        AdinmoManager.Sender?.LogError($"Reporting purchase failure to AdInMo: {iapId} - {reason}");
        
        try 
        {
            // Report the configuration failure to AdInMo
            AdinmoManager.InAppPurchaseFailed(iapId, currency, price, reason);
        }
        catch (Exception ex)
        {
            AdinmoManager.Sender?.LogError($"Failed to report purchase unavailability to AdInMo: {ex.Message}");
        }
    }

    static string GetLocalizedPriceString(string itemId)
    {
        if (_controller == null)
        {
            TryGetControllerFromUnityIAP();
        }
        
        var p = _controller?.products?.WithID(itemId);
        var price = p?.metadata?.localizedPriceString;
        AdinmoManager.Sender?.LogInfo($"Price requested for {itemId}: {price}");
        return price;
    }

    // ---- Proxy wrapper for Unity IAP ----

    class Proxy : IDetailedStoreListener
    {
        readonly IStoreListener _inner;
        public Proxy(IStoreListener inner) { _inner = inner; }

        function OnInitialized(IStoreController c, IExtensionProvider e)
        {
            _controller = c; // allow callbacks to query products & initiate purchases
            AdinmoManager.Sender?.LogInfo("Unity IAP initialized, store controller ready");
            _inner.OnInitialized(c, e);
        }

        function OnInitializeFailed(InitializationFailureReason error)
        {
            AdinmoManager.Sender?.LogError($"Unity IAP initialization failed: {error}");
            #pragma warning disable CS0612
            _inner.OnInitializeFailed(error);
            #pragma warning restore CS0612
        }

        function OnInitializeFailed(InitializationFailureReason error, string message)
        {
            AdinmoManager.Sender?.LogError($"Unity IAP initialization failed: {error} - {message}");
            _inner.OnInitializeFailed(error, message);
        }

        public PurchaseProcessingResult ProcessPurchase(PurchaseEventArgs args)
        {
            // Let game code decide success (Complete) vs Pending
            var result = _inner.ProcessPurchase(args);

            if (result == PurchaseProcessingResult.Complete)
            {
                ReportSuccess(args.purchasedProduct);
            }
            return result;
        }

        function OnPurchaseFailed(Product product, PurchaseFailureDescription failure)
        {
            // Try calling the newer method first, fallback to older method
            try
            {
                ((IDetailedStoreListener)_inner)?.OnPurchaseFailed(product, failure);
            }
            catch
            {
                // Fallback to legacy method if newer interface not implemented
                #pragma warning disable CS0618
                _inner.OnPurchaseFailed(product, failure?.reason ?? PurchaseFailureReason.Unknown);
                #pragma warning restore CS0618
            }
            ReportFailure(product, failure?.reason.ToString());
        }

        function OnPurchaseFailed(Product product, PurchaseFailureReason failureReason)
        {
            #pragma warning disable CS0618
            _inner.OnPurchaseFailed(product, failureReason);
            #pragma warning restore CS0618
            ReportFailure(product, failureReason.ToString());
        }

        // ---- Reporting helpers ----

        static void ReportSuccess(Product p)
        {
            if (p == null) return;
            var id   = p.definition?.id ?? "";
            var curr = p.metadata?.isoCurrencyCode ?? "";
            var amt  = (float)(p.metadata?.localizedPrice ?? 0m);
            var tx   = p.transactionID;

            AdinmoManager.Sender?.LogInfo($"Reporting success to AdInMo: {id}, {curr}, {amt}, {tx}");
            
            AdinmoManager.InAppPurchaseSuccess(id, curr, amt, tx);
        }

        static void ReportFailure(Product p, string reason)
        {
            if (p == null) return;
            var id   = p.definition?.id ?? "";
            var curr = p.metadata?.isoCurrencyCode ?? "";
            var amt  = (float)(p.metadata?.localizedPrice ?? 0m);

            AdinmoManager.Sender?.LogInfo($"Reporting failure to AdInMo: {id}, reason: {reason}");
            
            // Newer SDKs accept a failure reason parameter.
            try {
                AdinmoManager.InAppPurchaseFailed(id, curr, amt, reason);
            } catch {
                // Older SDKs without reason/source overload:
                AdinmoManager.InAppPurchaseFailed(id, curr, amt, null);
            }
        }
    }
}
#endif

// AdinmoInputHandler.cs




#if !ENABLE_LEGACY_INPUT_MANAGER && ENABLE_INPUT_SYSTEM


#endif

namespace Adinmo
{
    public static class AdinmoInputHandler
    {
        [Preserve]
        public static Vector2 GetPotentialTouchPos()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Application.platform == RuntimePlatform.WindowsEditor || Application.platform == RuntimePlatform.OSXEditor || Application.platform == RuntimePlatform.WebGLPlayer)
            {

                if (Input.GetMouseButton(0) || Input.GetMouseButtonUp(0) || Input.GetMouseButtonUp(0))
                {
                    return Input.mousePosition;
                }
            }
            else
            {
                if (Input.touchCount == 1)
                {
                    return Input.touches[0].position;
                }
            }

#elif ENABLE_INPUT_SYSTEM
            if (Application.platform == RuntimePlatform.WindowsEditor || Application.platform == RuntimePlatform.OSXEditor  || Application.platform == RuntimePlatform.WebGLPlayer)
            {

                if (Mouse.current.leftButton.isPressed || Mouse.current.leftButton.wasPressedThisFrame || Mouse.current.leftButton.wasReleasedThisFrame)
                {
                    return Mouse.current.position.ReadValue();
                }
            }
            else
            {
                if (UnityEngine.InputSystem.EnhancedTouch.Touch.activeTouches.Count == 1)
                {
                    return UnityEngine.InputSystem.EnhancedTouch.Touch.activeTouches[0].screenPosition;
                }
            }


#endif
            return -Vector2.one;
        }

        [Preserve]
        public static UnityEngine.Touch GetTouch()
        {
            UnityEngine.Touch touch = new UnityEngine.Touch();
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Application.platform == RuntimePlatform.WindowsEditor || Application.platform == RuntimePlatform.OSXEditor || Application.platform == RuntimePlatform.WebGLPlayer)
            {
                touch.position = Input.mousePosition;
                if (Input.mousePosition.x < 0 || Input.mousePosition.y < 0 || Input.mousePosition.x > Screen.width || Input.mousePosition.y > Screen.height)
                {
                    touch.phase = UnityEngine.TouchPhase.Canceled;
                }
                else if (Input.GetMouseButtonUp(0))
                {
                    touch.phase = UnityEngine.TouchPhase.Ended;
                }
                else if (Input.GetMouseButtonDown(0))
                {
                    touch.phase = UnityEngine.TouchPhase.Began;
                }
                else if (Input.GetMouseButton(0))
                {
                    touch.phase = UnityEngine.TouchPhase.Moved;
                }
            }
            else
            {
                touch = Input.GetTouch(0);
            }
#elif ENABLE_INPUT_SYSTEM
            if (Application.platform == RuntimePlatform.WindowsEditor || Application.platform == RuntimePlatform.OSXEditor || Application.platform == RuntimePlatform.WebGLPlayer)
            {
                touch.position = Mouse.current.position.ReadValue();
                if (touch.position.x < 0 || touch.position.y < 0 || touch.position.x > Screen.width || touch.position.y > Screen.height)
                {
                    touch.phase = UnityEngine.TouchPhase.Canceled;
                }
                else if (Mouse.current.leftButton.wasReleasedThisFrame)
                {
                    touch.phase = UnityEngine.TouchPhase.Ended;
                }
                else if (Mouse.current.leftButton.wasPressedThisFrame)
                {
                    touch.phase = UnityEngine.TouchPhase.Began;
                }
                else if (Mouse.current.leftButton.isPressed)
                {
                    touch.phase = UnityEngine.TouchPhase.Moved;
                }
            }
            else
            {
                UnityEngine.InputSystem.EnhancedTouch.Touch enhancedTouch = UnityEngine.InputSystem.EnhancedTouch.Touch.activeTouches[0];
                touch.position = enhancedTouch.screenPosition;
                switch (enhancedTouch.phase)
                {
                    case UnityEngine.InputSystem.TouchPhase.Began:
                        touch.phase = UnityEngine.TouchPhase.Began;
                        break;
                    case UnityEngine.InputSystem.TouchPhase.Canceled:
                        touch.phase = UnityEngine.TouchPhase.Canceled;
                        break;
                    case UnityEngine.InputSystem.TouchPhase.Ended:
                        touch.phase = UnityEngine.TouchPhase.Ended;
                        break;
                    case UnityEngine.InputSystem.TouchPhase.Moved:
                        touch.phase = UnityEngine.TouchPhase.Moved;
                        break;
                }

            }

#endif
            return touch;
        }
        [Preserve]
        function EnableEnhancedTouch()
        {
#if !ENABLE_LEGACY_INPUT_MANAGER && ENABLE_INPUT_SYSTEM
            UnityEngine.InputSystem.EnhancedTouch.EnhancedTouchSupport.Enable();
#endif
        }
        [Preserve]
        function Vibrate()
        {
#if UNITY_ANDROID || UNITY_IOS
            Handheld.Vibrate();
#endif
        }
    }


}



// AdinmoManagerEditor.cs







namespace Adinmo
{
    [CustomEditor(typeof(AdinmoManager))]
    [CanEditMultipleObjects]
    class AdinmoManagerEditor : Editor
    {
        private Texture2D AdinmoLogo;
        void OnEnable()
        {
            string editorScriptPath = AdinmoEditorCommon.getEditorScriptPath();
            
            AdinmoManager.m_iOSAdMobAppId = AdinmoEditorCommon.getiOSCode();
            AdinmoLogo = (Texture2D)AssetDatabase.LoadAssetAtPath(editorScriptPath + "/Textures/AdinMoLogo.png", typeof(Texture2D));
        }

        public override void OnInspectorGUI() //This controls how the GUI should be rendered in inspector
        {
            //Render the common AdinmoManagerUI
            Rect rect = new Rect();
            var oldLabelWidth = EditorGUIUtility.labelWidth;
            AdinmoEditorCommon.RenderAdinmoManagerUI(serializedObject, AdinmoLogo, ref rect, false,AdinmoEditorCommon.getEditorScriptPath());
            //Display the version number
            var versionStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.LowerRight, fontSize = 10 };
            EditorGUILayout.LabelField("", "v" + AdinmoSender.GetVersion() + " s" + AdinmoSender.GetSdkSource(), versionStyle);
        }
    }
}

// AdinmoNativeWrapper.cs
﻿






[assembly: Preserve]
namespace Adinmo
{
    class AdinmoNativeWrapper
    {
#if !UNITY_EDITOR && UNITY_WEBGL
        [DllImport("__Internal")]
        [Preserve] 
        private static extern string GetUserAgentJS();
        public static string GetUA()
        {
            string userAgent = GetUserAgentJS();
            return userAgent;
        }
#endif
#if !UNITY_EDITOR && UNITY_ANDROID
        [DllImport("AdinmoAndroidWebPlugin")]
        [RuntimeInitializeOnLoadMethod]
        public static extern System.IntPtr updateTexture();
#endif
#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        [Preserve]
        public static extern System.IntPtr AllocWebWrapper(System.IntPtr nativeTexturePointer, System.IntPtr webBitmap,int textureWidth, int textureHeight, int renderWidth, int renderHeight, string backgroundColour, int borderMode);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void ReleaseWebWrapper(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void LoadUrl(System.IntPtr webWrapper, string url);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void LoadHtml(System.IntPtr webWrapper, string html);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool GetFrame(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void RequestUserAgent(string gameObjectName, string callbackMethod);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool CalculateHash(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool GetNavigationComplete(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool UpToDate(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool GetContentHasLoaded(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern System.IntPtr AllocWebBitmap(string guid, int width, int height, string adinmoManagerName);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void ReleaseWebBitmap(System.IntPtr webWrapper);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool CopyWebpage(System.IntPtr webBitmap);

        [DllImport("__Internal")]
        [Preserve]
        public static extern System.IntPtr AllocAudioWrapper();

        [DllImport("__Internal")]
        [Preserve]
        public static extern void DownloadAudio(System.IntPtr ptr,string url,float timeout);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void PlayAudio(System.IntPtr ptr);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void StopAudio(System.IntPtr ptr);

        [DllImport("__Internal")]
        [Preserve]
        public static extern bool IsPlayingAudio(System.IntPtr ptr);

        [DllImport("__Internal")]
        [Preserve]
        public static extern float TimeAudio(System.IntPtr ptr);

        [DllImport("__Internal")]
        [Preserve]
        public static extern int GetStateAudio(System.IntPtr ptr);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void ReleaseAudioWrapper(System.IntPtr ptr);

        [DllImport("__Internal")]
        [Preserve]
        public static extern int GetCurrentVolume();

        [DllImport("__Internal")]
        [Preserve]
        public static extern void GetConsentString(byte[] byteArray);

        [DllImport ("__Internal")]
	    [Preserve]
        public static extern void StartListeningForMuteChanges();

	    [DllImport ("__Internal")]
        [Preserve]
	    public static extern void StopListeningForMuteChanges();

	    [DllImport ("__Internal")]
	    [Preserve]
        public static extern bool IsMuted();

        [DllImport("__Internal")]
        [Preserve]
        public static extern void LoadWebpageOnOverlay(string url, string adinmoManagerName, string domains);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void ReleaseWebOverlay();

        [DllImport("__Internal")]
        [Preserve]
        public static extern System.IntPtr LoadWebpageOnMagnifier(string url, string adinmoManagerName, float xpos, float ypos, float width, float height, float contentWidth, float contentHeight, int screenWidth, int screenHeight, string installerDomains);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void ReleaseWebMagnifier(System.IntPtr webMagnifier);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void OnTouch(System.IntPtr webWrapper,float x, float y, int touchPhase);



        [DllImport("__Internal")]
        [Preserve]
        public static extern bool CreateSKOverlay(string appID, string adinmoManagerName);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void RemoveSKOverlay();

        [DllImport("__Internal")]
        [Preserve]
        public static extern void OpenURL(string adinmoManagerName,string url);



#if ADINMO_UMP_IOS
        [DllImport("__Internal")]
        [Preserve]
        public static extern void loadUMP(string adinmoManagerName, string adModTestDeviceId, bool reset);

        [DllImport("__Internal")]
        [Preserve]
        public static extern void resetUMP();

#endif
#endif
    }
}
// AdinmoStoreController.cs

#nullable enable
#if ADINMO_UNITY_STORE_V5












namespace Adinmo
{
    /// <summary>
    /// Main controller class that provides a unified interface for store operations, product management, and purchase handling.
    /// </summary>
    /// 
    [Preserve]
    class AdinmoStoreController:StoreController 
    {
        public static AdinmoStoreController? Instance;
        [Preserve]
        public AdinmoStoreController(string? storeName = null):base(storeName)
        {
            OnPurchaseConfirmed += PurchaseConfirmed;
            OnPurchaseFailed += PurchaseFailed;
            Instance = this;
           
        }
        [Preserve]
        ~AdinmoStoreController()
        {
            OnPurchaseConfirmed -= PurchaseConfirmed;
            OnPurchaseFailed -= PurchaseFailed;
            Instance = null;
        }
        [Preserve]
        void PurchaseConfirmed(Order order)
        {
            foreach (var cartItem in order.CartOrdered.Items())
            {
                var product = cartItem.Product;
                switch (order)
                {
                    case FailedOrder failedOrder:
                        AdinmoManager.Sender?.LogInfo("Failed to order " + product + ", " + failedOrder.FailureReason);
                        AdinmoManager.InAppPurchaseFailed(product.definition.id, product.metadata.isoCurrencyCode, (float)product.metadata.localizedPrice, failedOrder.FailureReason.ToString());
                        break;
                    case ConfirmedOrder:

                        AdinmoManager.Sender?.LogInfo("Purchase confirmed for " + product );
                        AdinmoManager.InAppPurchaseSuccess(product.definition.id, product.metadata.isoCurrencyCode, (float)product.metadata.localizedPrice, order.Info.TransactionID);
                        break;
                }
             }
        }
        [Preserve]
        void PurchaseFailed(FailedOrder failedOrder)
        {
            foreach (var cartItem in failedOrder.CartOrdered.Items())
            {
                var product = cartItem.Product;
                AdinmoManager.Sender?.LogInfo("Failed to order " + product + ", " + failedOrder.FailureReason);
                AdinmoManager.InAppPurchaseFailed(product.definition.id, product.metadata.isoCurrencyCode, (float)product.metadata.localizedPrice, failedOrder.FailureReason.ToString());
            }
        }
        [Preserve]
        public static InAppAlreadyPurchasedReply CheckAlreadyPurchased(string IAP_ID)
        {
            if (Instance != null)
            {
                foreach (var order in Instance.GetPurchases())
                {
                    foreach (var cartItem in order.CartOrdered.Items())
                    {
                        Product product = cartItem.Product;
                        if (product.definition.id == IAP_ID)
                        {
                            AdinmoManager.Sender?.LogInfo(product.definition.id + " already purchased");
                            return new InAppAlreadyPurchasedReply(true, (float)product.metadata.localizedPrice, product.metadata.isoCurrencyCode);
                        }
                    }
                }
            }
            return new InAppAlreadyPurchasedReply(false);
        }
        [Preserve]
        public static string? GetPrice(string item)
        {
            if (Instance != null)
            {
                foreach (var product in Instance.GetProducts())
                {
                    if (product.definition.id == item)
                    {
                        return product.metadata.localizedPriceString;
                    }
                }
            }
            return null;
        }
        [Preserve]
        function PurchaseItem(string item)
        {
            if(Instance!= null)
            {
                Instance.PurchaseProduct(item);
            }
        }
    }
}
#endif
// AdinmoTexture.cs
﻿






////////////////////////////////////////////////////////////////////////////////////
// We create our own namespace to not overlap with your app
////////////////////////////////////////////////////////////////////////////////////
namespace Adinmo {


	public delegate void EventCallback( AdinmoTexture t );

	////////////////////////////////////////////////////////////////////////////////////
	class AdinmoTexture : AdinmoReplace {
		

		// Implementation

		private EventCallback m_onReadyCallback = null;
		private EventCallback m_onFailCallback = null;
		private GameObject m_debugBackground = null;
		private Image m_debugBackgroundImage = null;
        private GameObject m_debugForeground = null;
        private Image m_debugForegroundImage = null;
        private static bool s_bShowMessageFromServer = true;

        private const int BORDER_WIDTH= 3;
		////////////////////////////////////////////////////////////////////////////////////
		void Start() 
		{
			ShowMessageFromServer();
			Init();
		}
		
		
		////////////////////////////////////////////////////////////////////////////////////
		// Allow the server to print a debug message to the editor window just once.
		// This message is usually a notification that the SDK is oboslete
		////////////////////////////////////////////////////////////////////////////////////
		void ShowMessageFromServer()
		{
			if (s_bShowMessageFromServer)
			{
				s_bShowMessageFromServer = false;
				
				string message = AdinmoManager.GetMessageFromServer();
				if (message != null && message != "")
					Debug.Log( message );				
			}
		}


		////////////////////////////////////////////////////////////////////////////////////
		


		////////////////////////////////////////////////////////////////////////////////////
		public override bool IsImageActive()
		{
            if (m_rawImage)
                return m_rawImage.isActiveAndEnabled;
            else
                return m_image.isActiveAndEnabled;
		}

		////////////////////////////////////////////////////////////////////////////////////
		public override void Init() 
		{
			// Get the image component
			m_image = GetComponent<Image>();
			if (m_image != null)
				m_orignalImage = m_image.gameObject;
			else
				m_orignalImage = null;

			base.Init();
		}

		////////////////////////////////////////////////////////////////////////////////////
		function SetOnReadyCallback( EventCallback pfn )
		{
			m_onReadyCallback = pfn;
		}

		////////////////////////////////////////////////////////////////////////////////////
		function SetOnFailCallback( EventCallback pfn )
		{
			m_onFailCallback = pfn;
		}

		////////////////////////////////////////////////////////////////////////////////////
		protected override void OnReady()
		{
			// Let the owner know that this is ready with the downloaded texture
			if (m_onReadyCallback != null)
				m_onReadyCallback( this );
		}

		////////////////////////////////////////////////////////////////////////////////////
		protected override void OnFail()
		{
			// Let the owner know that this is ready with the downloaded texture
			if (m_onFailCallback != null)
				m_onFailCallback( this );
		}


		////////////////////////////////////////////////////////////////////
		protected override void SetRendererEnabled( bool bEnable )
		{
			SpriteRenderer sr = GetComponent<SpriteRenderer>();
			if (sr != null)
				sr.enabled = bEnable;
			else
			{
				MeshRenderer mr = GetComponent<MeshRenderer>();
				if (mr != null)
					mr.enabled = bEnable;

				else
				{
					Image i = GetComponent<Image>();
					if (i != null)
						i.enabled = bEnable;
				}
			}
		}


		////////////////////////////////////////////////////////////////////////////////////
		// Start drawing a red or green border around the image to say whether it is big enough
		////////////////////////////////////////////////////////////////////////////////////
		public override void UpdateDebugging( Color c, float percentRemaining )
		{		
			base.UpdateDebugging( c, percentRemaining );

			if (m_debugBackground != null && m_debugBackgroundImage != null)
			{
				DuplicateParentWidth(percentRemaining);
				m_debugBackgroundImage.color = c;
                m_debugForegroundImage.enabled = (c == Color.white);
			}
		}


		////////////////////////////////////////////////////////////////////////////////////
		// Start drawing a red or green border around the image to say whether it is big enough
		////////////////////////////////////////////////////////////////////////////////////
		public override void StartDebugging()
		{		
			base.StartDebugging();

			// Quads and Sprites are handled by the base class
			Image i = GetComponent<Image>();
			if (i == null)
				return;

			GameObject borderPrefab = (GameObject)Resources.Load("AdinmoDebugImage", typeof(GameObject));

			if (borderPrefab == null)
				return;

			m_debugBackground = Instantiate(borderPrefab, transform);
            m_debugBackground.name = "Debug Background";
			m_debugBackgroundImage = m_debugBackground.GetComponent<Image>();
            m_debugForeground = Instantiate(borderPrefab, transform);
            m_debugForeground.name = "Debug Foreground";
            m_debugForegroundImage = m_debugForeground.GetComponent<Image>();
            RectTransform fgRt = m_debugForeground.GetComponent<RectTransform>();
            fgRt.position += (Vector3.down+Vector3.right) * BORDER_WIDTH;

            DuplicateParentWidth(0);
		}

		////////////////////////////////////////////////////////////////////////////////////
		protected void DuplicateParentWidth(float percentRemaining)
		{
			RectTransform rt = GetComponent<RectTransform>();
			if (rt == null)
				return;
			
			RectTransform bgRt = m_debugBackground.GetComponent<RectTransform>();
			if (bgRt == null)
				return;
			bgRt.sizeDelta = new Vector2( rt.rect.width, 20 );
            RectTransform fgRt = m_debugForeground.GetComponent<RectTransform>();
            if (fgRt == null)
                return;
            float fgWidth = (rt.rect.width-BORDER_WIDTH*2) * percentRemaining;
            fgRt.sizeDelta = new Vector2(fgWidth, 20-BORDER_WIDTH*2);
            
        }
			
		////////////////////////////////////////////////////////////////////////////////////
		// Stop drawing a red or green border around the image to say whether it is big enough
		////////////////////////////////////////////////////////////////////////////////////
		public override void StopDebugging()
		{		
			base.StopDebugging();

			if (m_debugBackground)
				Destroy(m_debugBackground);
		}


	}

}

// AdinmoTextureEditor.cs
﻿




// Declare type of Custom Editor
namespace Adinmo
{
    [CustomEditor(typeof(AdinmoTexture))]
    class AdinmoTextureEditor : Editor
    {

        private SerializedProperty testImage;
        // OnInspector GUI
        public override void OnInspectorGUI()
        {
            base.DrawDefaultInspector();
            AdinmoTexture adinmoTexture = (AdinmoTexture)target;
            SerializedObject serObj = new SerializedObject(adinmoTexture);
            List<string> labels = new List<string>();
            int displayMask = 0;

            for (int i = 0; i < 32; i++)
            {
                if (LayerMask.LayerToName(i) != "")
                {
                    int tempMask = 1 << labels.Count;
                    labels.Add(LayerMask.LayerToName(i));

                    if ((1 << i & adinmoTexture.layerMask) != 0)
                        displayMask |= tempMask;
                }
            }

            if (labels.Count > 0)
            {
                int newDisplayMask = EditorGUILayout.MaskField("Occlusion test ignores Layers", displayMask, labels.ToArray());
                if (newDisplayMask != -1 && newDisplayMask != displayMask)
                {
                    int newMask = 0;
                    for (int i = 0; i < labels.Count; i++)
                    {
                        if ((newDisplayMask & 1 << i) != 0)
                        {
                            newMask |= 1 << LayerMask.NameToLayer(labels[i]);
                        }
                    }
                    Debug.Log("old layer mask=" + adinmoTexture.layerMask + ", new=" + newMask);

                    serializedObject.FindProperty("layerMask").intValue = newMask;
                }
                else if (newDisplayMask == -1)
                {
                    Debug.LogError("Can't filter out all layers");
                }
                serializedObject.ApplyModifiedProperties();
            }

            if (Application.isPlaying)
            {
                if (adinmoTexture.GetObjectType() == AdinmoReplace.ObjectType.Image || !(AdinmoManager.s_manager?.imageRenderDebug ?? false))
                {
                    EditorGUILayout.LabelField("Latest Sample", ("" + (adinmoTexture.LatestSample.sample * 100).ToString("F2") + "%"));
                }
                else
                {
                    EditorGUILayout.BeginHorizontal();

                    EditorGUILayout.PrefixLabel("Sample Texture");
                    GUILayout.Button(adinmoTexture.SampleTexture, GUILayout.Width(48), GUILayout.Height(48));
                    EditorGUILayout.BeginVertical(GUILayout.Width(50));
                    GUILayout.Label("Latest Sample");
                    GUILayout.Label("" + (adinmoTexture.LatestSample.sample * 100).ToString("F2") + "%");

                    EditorGUILayout.EndVertical();
                    EditorGUILayout.EndHorizontal();
                }
            }
        }
    }
}

// BasicRigidBodyPush.cs
﻿
namespace Adinmo.Examples
{
    class BasicRigidBodyPush : MonoBehaviour
    {
        public LayerMask pushLayers;
        public bool canPush;
        [Range(0.5f, 5f)] public float strength = 1.1f;

        private void OnControllerColliderHit(ControllerColliderHit hit)
        {
            if (canPush) PushRigidBodies(hit);
        }

        private void PushRigidBodies(ControllerColliderHit hit)
        {
            // https://docs.unity3d.com/ScriptReference/CharacterController.OnControllerColliderHit.html

            // make sure we hit a non kinematic rigidbody
            Rigidbody body = hit.collider.attachedRigidbody;
            if (body == null || body.isKinematic) return;

            // make sure we only push desired layer(s)
            var bodyLayerMask = 1 << body.gameObject.layer;
            if ((bodyLayerMask & pushLayers.value) == 0) return;

            // We dont want to push objects below us
            if (hit.moveDirection.y < -0.3f) return;

            // Calculate push direction from move direction, horizontal motion only
            Vector3 pushDir = new Vector3(hit.moveDirection.x, 0.0f, hit.moveDirection.z);

            // Apply the push and take strength into account
            body.AddForce(pushDir * strength, ForceMode.Impulse);
        }
    }
}
// CapsuleController.cs


namespace Adinmo.Examples
{
    class CapsuleController : MonoBehaviour
    {
        [SerializeField]
        GameObject CameraRoot;
        [SerializeField]
        float speed = 10.0f;
        [SerializeField]
        float mouseSpeed = 10.0f;
        CharacterController characterController;
        float localXAngle = 0;
        // Start is called before the first frame update
        void Start()
        {
            if (Application.isMobilePlatform)
            {
                enabled = false;
            }
            else
            {
                characterController = gameObject.GetComponent<CharacterController>();
            }
        }

        // Update is called once per frame
        void Update()
        {
            Vector2 inputVector = Vector2.zero;
            if (UnityEngine.Input.GetKey("w"))
            {
                inputVector = Vector2.up;
            }
            else if (UnityEngine.Input.GetKey("s"))
            {
                inputVector = Vector2.down;
            }
            if (UnityEngine.Input.GetKey("a"))
            {
                inputVector = Vector2.left;
            }
            else if (UnityEngine.Input.GetKey("d"))
            {
                inputVector = Vector2.right;
            }
            if (inputVector != Vector2.zero)
            {
                Vector3 desiredMove = transform.forward * inputVector.y + transform.right * inputVector.x;
                characterController.Move(desiredMove * speed * Time.deltaTime);
            }
            if (UnityEngine.Input.GetMouseButton(1)
#if !UNITY_EDITOR
                || UnityEngine.Input.GetMouseButton(0)
#endif
            )
            {

                transform.Rotate(Vector3.up, UnityEngine.Input.GetAxis("Mouse X") * mouseSpeed);
                localXAngle = localXAngle - UnityEngine.Input.GetAxis("Mouse Y") * mouseSpeed;
                if (localXAngle > 85)
                    localXAngle = 85;
                else if (localXAngle < -85)
                    localXAngle = -85;
                CameraRoot.transform.localEulerAngles = new Vector3(localXAngle, 0, 0);
            }
        }
    }
}
// ExampleCallbacks.cs
﻿


namespace Adinmo
{
	///////////////////////////////////////////////////////////////////
	// This class shows an example of how callbacks can be used
	// to know when the textures have been applied.
	//
	// This simple example hides the image until it is ready
	//
	///////////////////////////////////////////////////////////////////
	class ExampleCallbacks : MonoBehaviour
	{

		public AdinmoTexture m_imageToReplace;
		public bool m_bHideObjectUntilReady = true;

		///////////////////////////////////////////////////////////////////
		// Register callbacks
		///////////////////////////////////////////////////////////////////
		void Start()
		{
			// Global callback
			AdinmoManager.SetOnReadyCallback(OnAllTexturesDownloaded);
			// Callback per image if desired
			m_imageToReplace.SetOnReadyCallback(OnTextureReplace);
			m_imageToReplace.SetOnFailCallback(OnTextureFail);

			// Optionally hide the image until it is ready to be shown
			if (m_bHideObjectUntilReady)
				m_imageToReplace.gameObject.SetActive(false);
		}


		///////////////////////////////////////////////////////////////////
		// Once all textures have finished downloading
		///////////////////////////////////////////////////////////////////
		void ShowImage()
		{
			if (m_bHideObjectUntilReady)
				m_imageToReplace.gameObject.SetActive(true);
		}

		///////////////////////////////////////////////////////////////////
		// Once all textures have finished downloading
		///////////////////////////////////////////////////////////////////
		void OnAllTexturesDownloaded(string msg)
		{
			Debug.Log("Ready: " + msg);

			ShowImage();
		}


		///////////////////////////////////////////////////////////////////
		// Once this 
		///////////////////////////////////////////////////////////////////
		void OnTextureReplace(AdinmoTexture t)
		{
			Debug.Log("This texture has been replaced.");

			ShowImage();
		}


		///////////////////////////////////////////////////////////////////
		// Once all textures have finished downloading
		///////////////////////////////////////////////////////////////////
		void OnTextureFail(AdinmoTexture t)
		{
			Debug.Log("Texture not replaced -- Original texture will be seen");

			ShowImage();
		}
	}
}

// FirstPersonController.cs
﻿
#if ENABLE_INPUT_SYSTEM

#endif

namespace StarterAssets
{
	[RequireComponent(typeof(CharacterController))]

	class FirstPersonController : MonoBehaviour
	{
		[Header("Player")]
		[Tooltip("Move speed of the character in m/s")]
		public float MoveSpeed = 4.0f;
		[Tooltip("Sprint speed of the character in m/s")]
		public float SprintSpeed = 6.0f;
		[Tooltip("Rotation speed of the character")]
		public float RotationSpeed = 1.0f;
		[Tooltip("Acceleration and deceleration")]
		public float SpeedChangeRate = 10.0f;

		[Space(10)]
		[Tooltip("The height the player can jump")]
		public float JumpHeight = 1.2f;
		[Tooltip("The character uses its own gravity value. The engine default is -9.81f")]
		public float Gravity = -15.0f;

		[Space(10)]
		[Tooltip("Time required to pass before being able to jump again. Set to 0f to instantly jump again")]
		public float JumpTimeout = 0.1f;
		[Tooltip("Time required to pass before entering the fall state. Useful for walking down stairs")]
		public float FallTimeout = 0.15f;

		[Header("Player Grounded")]
		[Tooltip("If the character is grounded or not. Not part of the CharacterController built in grounded check")]
		public bool Grounded = true;
		[Tooltip("Useful for rough ground")]
		public float GroundedOffset = -0.14f;
		[Tooltip("The radius of the grounded check. Should match the radius of the CharacterController")]
		public float GroundedRadius = 0.5f;
		[Tooltip("What layers the character uses as ground")]
		public LayerMask GroundLayers;

		[Header("Cinemachine")]
		[Tooltip("The follow target set in the Cinemachine Virtual Camera that the camera will follow")]
		public GameObject CinemachineCameraTarget;
		[Tooltip("How far in degrees can you move the camera up")]
		public float TopClamp = 90.0f;
		[Tooltip("How far in degrees can you move the camera down")]
		public float BottomClamp = -90.0f;

		// cinemachine
		private float _cinemachineTargetPitch;

		// player
		private float _speed;
		private float _rotationVelocity;
		private float _verticalVelocity;
		private float _terminalVelocity = 53.0f;

		// timeout deltatime
		private float _jumpTimeoutDelta;
		private float _fallTimeoutDelta;

	

		private CharacterController _controller;
		private StarterAssetsInputs _input;
		private GameObject _mainCamera;

		private const float _threshold = 0.01f;


		private void Awake()
		{
			// get a reference to our main camera
			if (_mainCamera == null)
			{
				_mainCamera = GameObject.FindGameObjectWithTag("MainCamera");
			}
		}

		private void Start()
		{
			_controller = GetComponent<CharacterController>();
			_input = GetComponent<StarterAssetsInputs>();

			// reset our timeouts on start
			_jumpTimeoutDelta = JumpTimeout;
			_fallTimeoutDelta = FallTimeout;
		}

		private void Update()
		{
			JumpAndGravity();
			GroundedCheck();
			Move();
		}

		private void LateUpdate()
		{
			CameraRotation();
		}

		private void GroundedCheck()
		{
			// set sphere position, with offset
			Vector3 spherePosition = new Vector3(transform.position.x, transform.position.y - GroundedOffset, transform.position.z);
			Grounded = Physics.CheckSphere(spherePosition, GroundedRadius, GroundLayers, QueryTriggerInteraction.Ignore);
		}

		private void CameraRotation()
		{
			// if there is an input
			if (_input.look.sqrMagnitude >= _threshold)
			{
				//Don't multiply mouse input by Time.deltaTime
				float deltaTimeMultiplier =  Time.deltaTime;
				
				_cinemachineTargetPitch += _input.look.y * RotationSpeed * deltaTimeMultiplier;
				_rotationVelocity = _input.look.x * RotationSpeed * deltaTimeMultiplier;

				// clamp our pitch rotation
				_cinemachineTargetPitch = ClampAngle(_cinemachineTargetPitch, BottomClamp, TopClamp);

				// Update Cinemachine camera target pitch
				CinemachineCameraTarget.transform.localRotation = Quaternion.Euler(_cinemachineTargetPitch, 0.0f, 0.0f);

				// rotate the player left and right
				transform.Rotate(Vector3.up * _rotationVelocity);
			}
		}

		private void Move()
		{
			// set target speed based on move speed, sprint speed and if sprint is pressed
			float targetSpeed = _input.sprint ? SprintSpeed : MoveSpeed;

			// a simplistic acceleration and deceleration designed to be easy to remove, replace, or iterate upon

			// note: Vector2's == operator uses approximation so is not floating point error prone, and is cheaper than magnitude
			// if there is no input, set the target speed to 0
			if (_input.move == Vector2.zero) targetSpeed = 0.0f;

			// a reference to the players current horizontal velocity
			float currentHorizontalSpeed = new Vector3(_controller.velocity.x, 0.0f, _controller.velocity.z).magnitude;

			float speedOffset = 0.1f;
			float inputMagnitude = _input.analogMovement ? _input.move.magnitude : 1f;

			// accelerate or decelerate to target speed
			if (currentHorizontalSpeed < targetSpeed - speedOffset || currentHorizontalSpeed > targetSpeed + speedOffset)
			{
				// creates curved result rather than a linear one giving a more organic speed change
				// note T in Lerp is clamped, so we don't need to clamp our speed
				_speed = Mathf.Lerp(currentHorizontalSpeed, targetSpeed * inputMagnitude, Time.deltaTime * SpeedChangeRate);

				// round speed to 3 decimal places
				_speed = Mathf.Round(_speed * 1000f) / 1000f;
			}
			else
			{
				_speed = targetSpeed;
			}

			// normalise input direction
			Vector3 inputDirection = new Vector3(_input.move.x, 0.0f, _input.move.y).normalized;

			// note: Vector2's != operator uses approximation so is not floating point error prone, and is cheaper than magnitude
			// if there is a move input rotate player when the player is moving
			if (_input.move != Vector2.zero)
			{
				// move
				inputDirection = transform.right * _input.move.x + transform.forward * _input.move.y;
			}

			// move the player
			_controller.Move(inputDirection.normalized * (_speed * Time.deltaTime) + new Vector3(0.0f, _verticalVelocity, 0.0f) * Time.deltaTime);
		}

		private void JumpAndGravity()
		{
			if (Grounded)
			{
				// reset the fall timeout timer
				_fallTimeoutDelta = FallTimeout;

				// stop our velocity dropping infinitely when grounded
				if (_verticalVelocity < 0.0f)
				{
					_verticalVelocity = -2f;
				}

				// Jump
				if (_input.jump && _jumpTimeoutDelta <= 0.0f)
				{
					// the square root of H * -2 * G = how much velocity needed to reach desired height
					_verticalVelocity = Mathf.Sqrt(JumpHeight * -2f * Gravity);
				}

				// jump timeout
				if (_jumpTimeoutDelta >= 0.0f)
				{
					_jumpTimeoutDelta -= Time.deltaTime;
				}
			}
			else
			{
				// reset the jump timeout timer
				_jumpTimeoutDelta = JumpTimeout;

				// fall timeout
				if (_fallTimeoutDelta >= 0.0f)
				{
					_fallTimeoutDelta -= Time.deltaTime;
				}

				// if we are not grounded, do not jump
				_input.jump = false;
			}

			// apply gravity over time if under terminal (multiply by delta time twice to linearly speed up over time)
			if (_verticalVelocity < _terminalVelocity)
			{
				_verticalVelocity += Gravity * Time.deltaTime;
			}
		}

		private static float ClampAngle(float lfAngle, float lfMin, float lfMax)
		{
			if (lfAngle < -360f) lfAngle += 360f;
			if (lfAngle > 360f) lfAngle -= 360f;
			return Mathf.Clamp(lfAngle, lfMin, lfMax);
		}

		private void OnDrawGizmosSelected()
		{
			Color transparentGreen = new Color(0.0f, 1.0f, 0.0f, 0.35f);
			Color transparentRed = new Color(1.0f, 0.0f, 0.0f, 0.35f);

			if (Grounded) Gizmos.color = transparentGreen;
			else Gizmos.color = transparentRed;

			// when selected, draw a gizmo in the position of, and matching radius of, the grounded collider
			Gizmos.DrawSphere(new Vector3(transform.position.x, transform.position.y - GroundedOffset, transform.position.z), GroundedRadius);
		}
	}
}
// GameController2D.cs




namespace Adinmo.Examples
{
    class GameController2D : MonoBehaviour
    {
        // Start is called before the first frame update
        [SerializeField]
        GameObject BackgroundLayer;
        [SerializeField]
        GameObject ForegroundLayer;
        [SerializeField]
        SpriteRenderer characterSprite;
        [SerializeField]
        Sprite[] characterFrames;
        [SerializeField]
        GameObject pauseMenu;
        bool leftDown = false;
        bool rightDown = false;


        void Start()
        {

        }

        // Update is called once per frame
        void Update()
        {
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow) || leftDown)
            {
                MoveLeft();
            }
            else if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow) || rightDown)
            {
                MoveRight();
            }
        }

        function MoveLeft()
        {
            if (ForegroundLayer.transform.localPosition.x < -10)
            {
                BackgroundLayer.transform.Translate(Time.deltaTime * 1.5f, 0, 0);
                ForegroundLayer.transform.Translate(Time.deltaTime * 2.25f, 0, 0);
                characterSprite.flipX = false;
                int frame = (int)Math.Abs((ForegroundLayer.transform.localPosition.x * 3) % 2);
                characterSprite.sprite = characterFrames[frame];
            }
        }
        function MoveRight()
        {
            if (ForegroundLayer.transform.localPosition.x > -56)
            {
                BackgroundLayer.transform.Translate(-Time.deltaTime * 1.5f, 0, 0);
                ForegroundLayer.transform.Translate(-Time.deltaTime * 2.25f, 0, 0);
                characterSprite.flipX = true;
                int frame = (int)Math.Abs((ForegroundLayer.transform.localPosition.x * 3) % 2);
                characterSprite.sprite = characterFrames[frame];
            }
        }

        function OnLeftDown()
        {
            leftDown = true;
        }
        function OnLeftUp()
        {
            leftDown = false;
        }


        function OnRightDown()
        {
            rightDown = true;
        }
        function OnRightUp()
        {
            rightDown = false;
        }
        function PressPause()
        {
            pauseMenu.SetActive(true);
        }

        function PressResume()
        {
            pauseMenu.SetActive(false);
        }
    }
}
// MobileDisableAutoSwitchControls.cs
/*
The PlayerInput component has an auto-switch control scheme action that allows automatic changing of connected devices.
IE: Switching from Keyboard to Gamepad in-game.
When built to a mobile phone; in most cases, there is no concept of switching connected devices as controls are typically driven through what is on the device's hardware (Screen, Tilt, etc)
In Input System 1.0.2, if the PlayerInput component has Auto Switch enabled, it will search the mobile device for connected devices; which is very costly and results in bad performance.
This is fixed in Input System 1.1.
For the time-being; this script will disable a PlayerInput's auto switch control schemes; when project is built to mobile.
*/


namespace Adinmo.Examples
{
    class MobileDisableAutoSwitchControls : MonoBehaviour
    {
        private void Start()
        {
            if (!Application.isMobilePlatform)
                gameObject.SetActive(false);

        }


    }
}
// PauseHandler.cs

/// <summary>
/// An example of a class that can handle the automatic pausing of the game when the Magnifier is showing
/// </summary>
/// 
namespace Adinmo
{
    class PauseHandler : MonoBehaviour
    {
        // Start is called before the first frame update
        void Start()
        {
            AdinmoManager.SetPauseGameCallback(gamePaused);
            AdinmoManager.SetResumeGameCallback(gameResumed);
        }


        function gamePaused()
        {
            //Add game specific code for handling pausing the game
            Time.timeScale = 0;
        }

        function gameResumed()
        {
            //Add game specific code for handling resuming the game
            Time.timeScale = 1;
        }
    }
}
// StarterAssetsInputs.cs

#if ENABLE_INPUT_SYSTEM

#endif

namespace StarterAssets
{
	class StarterAssetsInputs : MonoBehaviour
	{
		[Header("Character Input Values")]
		public Vector2 move;
		public Vector2 look;
		public bool jump;
		public bool sprint;

		[Header("Movement Settings")]
		public bool analogMovement;

		[Header("Mouse Cursor Settings")]
		public bool cursorLocked = true;
		public bool cursorInputForLook = true;

#if ENABLE_INPUT_SYSTEM
		function OnMove(InputValue value)
		{
			MoveInput(value.Get<Vector2>());
		}

		function OnLook(InputValue value)
		{
			if(cursorInputForLook)
			{
				LookInput(value.Get<Vector2>());
			}
		}

		function OnJump(InputValue value)
		{
			JumpInput(value.isPressed);
		}

		function OnSprint(InputValue value)
		{
			SprintInput(value.isPressed);
		}
#endif


		function MoveInput(Vector2 newMoveDirection)
		{
			move = newMoveDirection;
		} 

		function LookInput(Vector2 newLookDirection)
		{
			look = newLookDirection;
		}

		function JumpInput(bool newJumpState)
		{
			jump = newJumpState;
		}

		function SprintInput(bool newSprintState)
		{
			sprint = newSprintState;
		}
		
		private void OnApplicationFocus(bool hasFocus)
		{
			SetCursorState(cursorLocked);
		}

		private void SetCursorState(bool newState)
		{
			Cursor.lockState = newState ? CursorLockMode.Locked : CursorLockMode.None;
		}
	}
	
}
// StoreHandler.cs
//#define UNITY_STORE





#if ADINMO_UNITY_STORE_V4





namespace Adinmo.Examples
{
    /// <summary>
    /// A IAP store that uses the standard Unity In App Purchasing package from the Package Manager
    /// </summary>
    /// 

    class StoreHandler : MonoBehaviour, IDetailedStoreListener

    {

        private IStoreController StoreController;
        private IExtensionProvider ExtensionProvider;

        private async void Awake()
        {
            InitializationOptions options = new InitializationOptions()
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            .SetEnvironmentName("test");
#else
        .SetEnvironmentName("production");
#endif
            await UnityServices.InitializeAsync(options);
            ResourceRequest operation = Resources.LoadAsync<TextAsset>("IAPProductCatalog");
            operation.completed += HandleIAPCatalogLoaded;


        }

        void Start()
        {
        }

        private void HandleIAPCatalogLoaded(AsyncOperation Operation)
        {
            ResourceRequest request = Operation as ResourceRequest;
            Debug.Log($"Loaded Asset: {request.asset}");
            ProductCatalog catalog = JsonUtility.FromJson<ProductCatalog>((request.asset as TextAsset).text);
            Debug.Log($"Loaded catalog with {catalog.allValidProducts.Count} items");
            //StandardPurchasingModule.Instance().useFakeStoreUIMode = FakeStoreUIMode.StandardUser;
            //StandardPurchasingModule.Instance().useFakeStoreAlways = true;
#if UNITY_ANDROID
            ConfigurationBuilder builder = ConfigurationBuilder.Instance(
                StandardPurchasingModule.Instance(AppStore.GooglePlay)
                );
#elif UNITY_IOS
        ConfigurationBuilder builder = ConfigurationBuilder.Instance(
            StandardPurchasingModule.Instance(AppStore.AppleAppStore)
            );
#else
        ConfigurationBuilder builder = ConfigurationBuilder.Instance(
            StandardPurchasingModule.Instance(AppStore.NotSpecified)
            );
#endif

            foreach (ProductCatalogItem item in catalog.allProducts)
            {
                builder.AddProduct(item.id, item.type);
            }
            UnityPurchasingAdInMoExtensions.InitializeWithAdInMo(this, builder);
        }

        function OnInitialized(IStoreController controller, IExtensionProvider extensions)
        {
            StoreController = controller;
            ExtensionProvider = extensions;
        }



        function PurchaseItem(string item)
        {
            if (StoreController != null)
            {
                foreach (var product in StoreController.products.all)
                {
                    if (product.definition.id == item)
                    {
                        Debug.Log("want to buy " + product.definition.id);
                        StoreController.InitiatePurchase(item);
                        return;
                    }
                }
                Debug.LogWarning("couldn't find iap " + item);
            }
            else
            {
                Debug.LogError("Can't make purchase, storecontroller is not initialised");
            }
        }


        function OnInitializeFailed(InitializationFailureReason error, string message)
        {
            Debug.LogError($"Error initializing IAP because of {error} {message}." +
                     $"\r\nShow a message to the player depending on this error");
        }

        function OnPurchaseFailed(Product product, PurchaseFailureDescription failureDescription)
        {
            Debug.Log("outer handling purchase failed des");
        }

        function OnPurchaseFailed(Product product, PurchaseFailureReason failureReason)
        {
            Debug.Log("outer handling purchase failed reas");
        }

        public PurchaseProcessingResult ProcessPurchase(PurchaseEventArgs purchaseEvent)
        {
            Debug.Log("outer handling processpurchase");
            return PurchaseProcessingResult.Complete;
        }

        function OnInitializeFailed(InitializationFailureReason error)
        {
            Debug.LogError($"Error initializing IAP because of {error}." +
                    $"\r\nShow a message to the player depending on this error");
        }
    }
}

#endif
// StoreHandler_Fake.cs







namespace Adinmo
{ 
/// <summary>
/// a fake store used to demonstrate how to test basic store actions
/// </summary>
class FakeStoreHandler : MonoBehaviour
    {
        public GameObject StoreCanvas;
        public Text purchaseButton;
        static string iapID;
#if !ADINMO_UNITY_STORE_V4 && !ADINMO_UNITY_STORE_V5
        private void Start()
        {
            StoreCanvas=GetComponentInChildren<Canvas>(true).gameObject;
            var textObjects=GetComponentsInChildren<Text>(true);
            foreach (var textObject in textObjects)
            {
                if(textObject.name=="btnPurchase")
                {
                    purchaseButton = textObject;
                    break;
                }
            }
            AdinmoManager.SetInAppPurchaseCallback(PurchaseItem);
            AdinmoManager.SetInAppPurchaseGetPriceCallback(GetPrice);
            AdinmoManager.SetInAppPurchasedAlreadyCallback(CheckAlreadyPurchased);
        }
        function PurchaseItem(string iap_id)
        {
            iapID = iap_id;
            StoreCanvas.SetActive(true);
            purchaseButton.text = "Purchase " + iapID + "?";
        }

        function makePurchase()
        {
            AdinmoManager.InAppPurchaseSuccess(iapID, "GBP", 0.00f, "testTransaction");
            StoreCanvas.SetActive(false);
        }

        function refusePurchase()
        {
            AdinmoManager.InAppPurchaseFailed(iapID, "GBP", 0.00f, "Declined purchase");
            StoreCanvas.SetActive(false);
        }

        public static string GetPrice(string iap_id)
        {
            return "$1.99";
        }

        public static InAppAlreadyPurchasedReply CheckAlreadyPurchased(string iap_id)
        {
            return new InAppAlreadyPurchasedReply(false);
        }
        
#endif
    }
}



// StoreHandler_V5.cs

#if ADINMO_UNITY_STORE_V5
















 namespace Adinmo.Examples
{   /// <summary>
    /// A IAP store that uses the standard Unity In App Purchasing package from the Package Manager
    /// </summary>
    /// 

    class StoreHandler : MonoBehaviour

    {
        AdinmoStoreController m_StoreController;

        protected void Awake()
        {
            InitializeIAP();
        }

        async void InitializeIAP()
        {
            m_StoreController = new AdinmoStoreController();

            m_StoreController.OnPurchasePending += OnPurchasePending;
            m_StoreController.OnPurchaseConfirmed += OnPurchaseConfirmed;

            await m_StoreController.Connect();

            FetchProducts();
        }

        void OnPurchasePending(PendingOrder order)
        {
            // Add your validations here before confirming the purchase.

            // Before confirming the purchase, reward the entitlement to the player.
            m_StoreController.ConfirmPurchase(order);
        }
        /// <summary>
        /// method for processing confirmed purchases
        /// </summary>
        /// <param name="order"></param>
        void OnPurchaseConfirmed(Order order)
        {
            switch (order)
            {
                case FailedOrder failedOrder:
                    // put in code for handling a failed order
                    LogConsole($"Purchase confirmation failed: {failedOrder.CartOrdered.Items().First().Product.definition.id}, {failedOrder.FailureReason.ToString()}, {failedOrder.Details}");
                    break;
                case ConfirmedOrder:
                    // put in code for handling a successful order
                    LogConsole($"Purchase completed:  {order.CartOrdered.Items().First().Product.definition.id}");
                    break;
            }
        }

        void FetchProducts()
        {
            var initialProductsToFetch = new List<ProductDefinition>
            {
                //insert your products here
            };
            m_StoreController.FetchProducts(initialProductsToFetch);
        }
        /// <summary>
        /// code for handling purchasing an IAP
        /// </summary>
        /// <param name="productId"></param>
        function InitiatePurchase(string productId)
        {
            var product = m_StoreController?.GetProducts().FirstOrDefault(product => product.definition.id == productId);

            if (product != null)
            {
                m_StoreController?.PurchaseProduct(product);
            }
            else
            {
                LogConsole($"The product service has no product with the ID {productId}");
            }
        }

        function RestorePurchases()
        {
            m_StoreController.RestoreTransactions(OnTransactionsRestored);
        }

        void OnTransactionsRestored(bool success, string error)
        {
            LogConsole("Transactions restored: " + success);
        }

        void LogConsole(string msg)
        {
            Debug.Log(msg);
        }

    }
}
#endif
// StoreSelector.cs





class StoreSelector : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {
#if ADINMO_UNITY_STORE_V4
        gameObject.AddComponent<StoreHandler>();
#elif ADINMO_UNITY_STORE_V5
        gameObject.AddComponent<StoreHandler>();
#else
        GameObject.Instantiate(Resources.Load("Fake StoreHandler"),this.transform);
#endif
    }


}

// UICanvasControllerInput.cs


namespace StarterAssets
{
    class UICanvasControllerInput : MonoBehaviour
    {

        [Header("Output")]
        public StarterAssetsInputs starterAssetsInputs;

        function VirtualMoveInput(Vector2 virtualMoveDirection)
        {
            starterAssetsInputs.MoveInput(virtualMoveDirection);
        }

        function VirtualLookInput(Vector2 virtualLookDirection)
        {
            starterAssetsInputs.LookInput(virtualLookDirection);
        }

        function VirtualJumpInput(bool virtualJumpState)
        {
            starterAssetsInputs.JumpInput(virtualJumpState);
        }

        function VirtualSprintInput(bool virtualSprintState)
        {
            starterAssetsInputs.SprintInput(virtualSprintState);
        }
        
    }

}

// UIVirtualButton.cs




namespace Adinmo.Examples
{
    class UIVirtualButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerClickHandler
    {
        [System.Serializable]
        class BoolEvent : UnityEvent<bool> { }
        [System.Serializable]
        class Event : UnityEvent { }

        [Header("Output")]
        public BoolEvent buttonStateOutputEvent;
        public Event buttonClickOutputEvent;

        function OnPointerDown(PointerEventData eventData)
        {
            OutputButtonStateValue(true);
        }

        function OnPointerUp(PointerEventData eventData)
        {
            OutputButtonStateValue(false);
        }

        function OnPointerClick(PointerEventData eventData)
        {
            OutputButtonClickEvent();
        }

        void OutputButtonStateValue(bool buttonState)
        {
            buttonStateOutputEvent.Invoke(buttonState);
        }

        void OutputButtonClickEvent()
        {
            buttonClickOutputEvent.Invoke();
        }

    }
}

// UIVirtualJoystick.cs




namespace Adinmo.Examples
{
    class UIVirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        [System.Serializable]
        class Event : UnityEvent<Vector2> { }

        [Header("Rect References")]
        public RectTransform containerRect;
        public RectTransform handleRect;

        [Header("Settings")]
        public float joystickRange = 50f;
        public float magnitudeMultiplier = 1f;
        public bool invertXOutputValue;
        public bool invertYOutputValue;
        int finger_id = -1;

        [Header("Output")]
        public Event joystickOutputEvent;

        void Start()
        {
            SetupHandle();
        }

        private void SetupHandle()
        {
            if (handleRect)
            {
                UpdateHandleRectPosition(Vector2.zero);
            }
        }

        function OnPointerDown(PointerEventData eventData)
        {
            OnDrag(eventData);
        }

        function OnDrag(PointerEventData eventData)
        {

            RectTransformUtility.ScreenPointToLocalPointInRectangle(containerRect, eventData.position, eventData.pressEventCamera, out Vector2 position);

            position = ApplySizeDelta(position);

            Vector2 clampedPosition = ClampValuesToMagnitude(position);

            Vector2 outputPosition = ApplyInversionFilter(position);

            OutputPointerEventValue(outputPosition * magnitudeMultiplier);

            if (handleRect)
            {
                UpdateHandleRectPosition(clampedPosition * joystickRange);
            }

        }

        function OnDrag(Touch touch)
        {

            RectTransformUtility.ScreenPointToLocalPointInRectangle(containerRect, touch.position, Camera.main, out Vector2 position);

            position = ApplySizeDelta(position);

            Vector2 clampedPosition = ClampValuesToMagnitude(position);

            Vector2 outputPosition = ApplyInversionFilter(position);

            OutputPointerEventValue(outputPosition * magnitudeMultiplier);

            if (handleRect)
            {
                UpdateHandleRectPosition(clampedPosition * joystickRange);
            }

        }

        function OnPointerUp(PointerEventData eventData)
        {
            OutputPointerEventValue(Vector2.zero);

            if (handleRect)
            {
                UpdateHandleRectPosition(Vector2.zero);
            }
        }

        function OnPointerUp(Touch touch)
        {
            OutputPointerEventValue(Vector2.zero);
            if (touch.fingerId == finger_id)
            {
                finger_id = -1;
                if (handleRect)
                {
                    UpdateHandleRectPosition(Vector2.zero);
                }
            }
        }

        private void OutputPointerEventValue(Vector2 pointerPosition)
        {
            joystickOutputEvent.Invoke(pointerPosition);
        }

        private void UpdateHandleRectPosition(Vector2 newPosition)
        {
            handleRect.anchoredPosition = newPosition;
        }

        Vector2 ApplySizeDelta(Vector2 position)
        {
            float x = (position.x / containerRect.sizeDelta.x) * 2.5f;
            float y = (position.y / containerRect.sizeDelta.y) * 2.5f;
            return new Vector2(x, y);
        }

        Vector2 ClampValuesToMagnitude(Vector2 position)
        {
            return Vector2.ClampMagnitude(position, 1);
        }

        Vector2 ApplyInversionFilter(Vector2 position)
        {
            if (invertXOutputValue)
            {
                position.x = InvertValue(position.x);
            }

            if (invertYOutputValue)
            {
                position.y = InvertValue(position.y);
            }

            return position;
        }

        float InvertValue(float value)
        {
            return -value;
        }


        void Update()
        {
            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);
                switch (touch.phase)
                {
                    case TouchPhase.Began:
                        if (RectTransformUtility.RectangleContainsScreenPoint(containerRect, touch.position, Camera.main))
                        {
                            finger_id = touch.fingerId;
                            OnDrag(touch);
                        }
                        break;
                    case TouchPhase.Moved:
                        if (touch.fingerId == finger_id)
                        {
                            OnDrag(touch);
                        }
                        break;
                    case TouchPhase.Ended:
                    case TouchPhase.Canceled:
                        OnPointerUp(touch);
                        break;
                }
            }
        }
    }
}
// ZBDController.cs
﻿



namespace Adinmo
{
    class ZBDController : MonoBehaviour
    {

        #region Public variables

        [Header("Bitcoin Counter Button")]
        // Reference to the Text component that displays the bitcoins numbers
        public Text MainBitcoinCounter;
        [Header("Cash Out Panels")]
        // Reference to the pabel warning 
        public GameObject Warning_Panel;
        // Reference to the CashOut panel
        public GameObject CashOut_Panel;
        // Reference to the error panrl component 
        public GameObject ErrorPanel;
        // Reference to the text for the Error
        public Text ErrorText;
        // Reference to the SucessPanel
        public GameObject SuccessPanel;
        // Reference to the Success Text
        public Text SuccessText;
        // the amount in dollars on the display screen
        public Text DollarText;

        [Header("Cashout Bitcoin Panel Elements")]
        // Reference to the Bitcoin amount to convert
        public Text CashoutBitcoinAmount;
        // Reference to the Slider
        public Slider Slider;
        // Reference to the Slider Amount
        public Text SlideAmount;
        // Reference to the GamerTag component 
        public InputField GamerTagInputField;
        // WidthdrawlButton
        public Button WithdrawlButton;
        // time allowed to animate the total updating
        const float ANIMATION_TIME = 1.0f;
        // remaining time in the animation
        float animationTimeRemaining = 0.0f;
        uint currentValue = 0;
        uint targetValue = 0;

        #endregion

        #region private variables
        // Color to change
        private Color SelectedColor;

        #endregion


        function Start()
        {
            if (AdinmoManager.IsReady())
            {
                statusCallback("");
            }
            else
            {
                gameObject.SetActive(false);
                AdinmoManager.AddOnReadyListener(statusCallback);
            }

        }
        function CashOutBitcoin()
        {
            // Check if the number of Bitcoin is greater than 0 to open the withdraw panel if not open the warning panel.
            uint satsBalance = AdinmoManager.GetZBDSatsBalance();
            CashoutBitcoinAmount.text = AdinmoUtilities.ToEngineeringNotation(satsBalance);
            DollarText.text = "$" + AdinmoManager.GetZBDDollarBalance();
            GamerTagInputField.SetTextWithoutNotify(AdinmoManager.GetZBDGamerTag());
            FillSlider(satsBalance, AdinmoManager.GetZBDGamerTag());
            CashOut_Panel.SetActive(true);



        }



        //convert bitcoint amount to Slider
        function FillSlider(uint satsBalance, string gamertag)
        {
            if (satsBalance == 0 || string.IsNullOrEmpty(gamertag))
            {
                Slider.maxValue = 0;
                Slider.minValue = 0;
                WithdrawlButton.interactable = false;
                Slider.value = 0;
                SlideAmount.text = "Withdraw 0";
            }
            else
            {
                Slider.minValue = 1;
                Slider.maxValue = satsBalance;
                WithdrawlButton.interactable = true;
                Slider.value = satsBalance;
                SlideAmount.text = "Withdraw " + AdinmoUtilities.ToEngineeringNotation(satsBalance);
            }

        }

        function SliderUpdated()
        {
            SlideAmount.text = "Withdraw " + AdinmoUtilities.ToEngineeringNotation(Slider.value);
        }

        //Open the link for download the zebedee wallet
        function GetZebedeeWallet()
        {

            AdinmoManager.OpenURL(AdinmoManager.GetRewardedUrlTracker());
        }

        function OnEnable()
        {
            AdinmoManager.SetZBDOpCallback(opCallback);
            AdinmoManager.SetZBDUpdateCallback(updateCallback);
            uint satsBalance = AdinmoManager.GetZBDSatsBalance();
            CashoutBitcoinAmount.text = AdinmoUtilities.ToEngineeringNotation(satsBalance);
            SetBitcoinCounter(satsBalance, false);
            DollarText.text = "$" + AdinmoManager.GetZBDDollarBalance();
        }

        function OnDisable()
        {
            AdinmoManager.SetZBDOpCallback(null);
            AdinmoManager.SetZBDUpdateCallback(null);
        }

        void statusCallback(string message)
        {
            gameObject.SetActive(AdinmoManager.SupportsZebedee);
            AdinmoManager.SetZBDOpCallback(opCallback);
            AdinmoManager.SetZBDUpdateCallback(updateCallback);

            uint satsBalance = AdinmoManager.GetZBDSatsBalance();
            CashoutBitcoinAmount.text = AdinmoUtilities.ToEngineeringNotation(satsBalance);
            SetBitcoinCounter(satsBalance, false);
            DollarText.text = "$" + AdinmoManager.GetZBDDollarBalance();


        }
        void opCallback(bool success, string gamertag, uint balanceSats, float balanceChangeSats, float balanceDollars, string feedback)
        {
            AdinmoManager.LogInfo("zbd op callback success=" + success + ", gamerTag=" + gamertag + ", balanceSats=" + balanceSats + ", balanceDollars=" + balanceDollars + ", balanceChange=" + balanceChangeSats + ", feeedbacl=" + feedback);
            CashoutBitcoinAmount.text = AdinmoUtilities.ToEngineeringNotation(balanceSats);
            SetBitcoinCounter(balanceSats);
            DollarText.text = "$" + AdinmoManager.GetZBDDollarBalance();
            GamerTagInputField.interactable = false;
            GamerTagInputField.text = gamertag;
            GamerTagInputField.interactable = true;
            FillSlider(balanceSats, gamertag);
            if (!string.IsNullOrEmpty(feedback))
            {
                if (success)
                {
                    CashOut_Panel.SetActive(false);
                    SuccessPanel.SetActive(true);
                    SuccessText.text = feedback;

                }
                else
                {
                    ErrorPanel.SetActive(true);
                    ErrorText.text = feedback;
                }
            }


        }

        void updateCallback(bool success, string gamertag, uint balanceSats, float balanceChangeSats, float balanceDollars, string feedback)
        {
            AdinmoManager.LogInfo("zbd update callback success=" + success + ", gamerTag=" + gamertag + ", balanceSats=" + balanceSats + ", balanceDollars=" + balanceDollars + ", balanceChange=" + balanceChangeSats + ", feeedback=" + feedback);
            SetBitcoinCounter(balanceSats);
        }

        function EditGamerTag(string oldTag)
        {
            AdinmoManager.SetZBDGamerTag(GamerTagInputField.text);
        }

        function ClickWithdraw()
        {
            WithdrawlButton.interactable = false;
            AdinmoManager.ZBDCashOut(GamerTagInputField.text, (int)Slider.value * 1000);

        }

        private void Update()
        {
            if (animationTimeRemaining > 0)
            {
                animationTimeRemaining -= Time.deltaTime;
                if (animationTimeRemaining > 0)
                {
                    uint displayValue = (uint)Mathf.Lerp(targetValue, currentValue, animationTimeRemaining / ANIMATION_TIME);
                    MainBitcoinCounter.text = AdinmoUtilities.ToEngineeringNotation(displayValue);
                }
                else
                {
                    currentValue = targetValue;
                    MainBitcoinCounter.text = AdinmoUtilities.ToEngineeringNotation(targetValue);
                    animationTimeRemaining = 0.0f;
                }

            }
        }

        void SetBitcoinCounter(uint newAmount, bool animated = true)
        {
            if (newAmount != currentValue)
            {
                if (!animated)
                {
                    currentValue = newAmount;
                    MainBitcoinCounter.text = AdinmoUtilities.ToEngineeringNotation(newAmount);
                }
                else
                {
                    targetValue = newAmount;
                    animationTimeRemaining = ANIMATION_TIME;
                }
            }
        }

    }
}

