(function ($) {
  var key, pub, quizType;

  // initialize tabletop library
  function init() {
    console.log("2. INIT TABLETOP");
    Tabletop.init({ key: url, callback: readData, simpleSheet: true });
  }

  function readData(data, tabletop) {
    input = [];
    for (var i = 0; i < data.length; i++) {
      input[i] = findUrlinObject(data[i]);
    }
    //console.log(input);
    embed(input);
  }

  function findUrlinObject(data) {
    $.each(data, function (key, value) {
      if (key == "correct" || key == "incorrect" || key == "text") {
        data[key] = converttoHex(data[key]);
      }
    });
    return data;
  }

  function converttoHex(string) {
    var hex, i;
    var result = "";
    for (i = 0; i < string.length; i++) {
      hex = string.charCodeAt(i).toString(16);
      result += ("000" + hex).slice(-4);
    }
    return result;
  }

  function addJS() {
    quizType = "quiz"; // $('input[name="quiz-type"]:checked').val(); // TODO: Fix testing change to this, reset back to input check instead of default 'vox' value
    if (quizType == "quiz") {
      $("body").append(
        '<script src="/javascripts/quiz.js" type="text/javascript"></script>'
      );
    } else if (quizType == "flowchart") {
      $("body").append(
        '<script src="/javascripts/flowchart.js" type="text/javascript"></script>'
      );
    } else {
      $("body").append(
        '<script src="/javascripts/binary.js" type="text/javascript"></script>'
      );
    }
  }

  function changeTemplate() {
    if (quizType == "quiz") {
      $("#quiz-template")
        .attr(
          "href",
          "https://drive.google.com/previewtemplate?id=0AlMgrVuuAI0MdGl6NngwMGYtX3RHQjlic0xzNnBjUGc&mode=public"
        )
        .addClass("template");
      $("#example-spreadsheet").val(
        "https://docs.google.com/spreadsheet/pub?key=0AlMgrVuuAI0MdGl6NngwMGYtX3RHQjlic0xzNnBjUGc&output=html"
      );
    } else if (quizType == "flowchart") {
      $("#quiz-template")
        .attr(
          "href",
          "https://drive.google.com/previewtemplate?id=0AlMgrVuuAI0MdE9ZNVhnYmk0TUdidGhiZTgwT0F6MGc&mode=public"
        )
        .addClass("template");
      $("#example-spreadsheet").val(
        "https://docs.google.com/spreadsheet/pub?key=0ArcRX35HpjojdGlSR012UjVDZkpIM19ObVY5TE03U2c&output=html"
      );
    } else {
      $("#quiz-template")
        .attr(
          "href",
          "https://drive.google.com/previewtemplate?id=0AlMgrVuuAI0MdFlNdHlNay1ibnNSWU93TThTS1VuSVE&mode=public"
        )
        .addClass("template");
      $("#example-spreadsheet").val(
        "https://docs.google.com/spreadsheets/d/1UIiEZwiwsOAZ7jTZ8xzJJj35Y55Mg6TCcVR4qM_A1rg/pubhtml"
      );
    }
  }

  function submitquiz() {
    quizType = $('input[name="quiz-type"]:checked').val();
    if (quizType == "quiz") {
      $(".quiz-container").empty();
      //console.log("QUIZ SUBMIT");
      buildquiz();
    } else {
      $(".quiz-container").empty();
      buildflowchart();
    }
  }

  function getStylesheet() {
    pub = $('input[name="pub"]:checked').val();
    //console.log("PUB", pub)
    $("body").append(
      '<script type="text/javascript">var pub ="' + pub + '"</script>'
    );
    pubStylesheet =
      "http://assets.sbnation.com.s3.amazonaws.com/features/quiz-generator/quiz-" +
      pub +
      ".css";
    // pubStylesheet = "/stylesheets/quiz-" + pub + ".css";
  }

  function embed(input) {
    console.log("16. QUIZ INPUT", input);
    /*"<div class='progress'>Question " + qnumber + "&nbsp;of&nbsp;" + input.length + "</div><div class='qq-question'><div class='qq-description'>" + input[currentQuestion].description + "</div><br><div class='question'>" + input[currentQuestion].question + "</div></div>" +
      "<ol class='answers'><li id='option-a'>" + input[currentQuestion].a + "</li>" +
      "<li id='option-b'>" + input[currentQuestion].b + "</li>" +
      "<li id='option-c'>" + input[currentQuestion].c + "</li>" +
      "<li id='option-d'>" + input[currentQuestion].d + "</li></ol>" +
      "<button class='qq-button hint'>Need a hint?</button>" +
      "<button class='qq-button submit-answer'>Submit answer</button>" +
      "<div class='answer'></div>"*/
    let embedInput = []
    for (let i = 0; i < input.length; i++) {
      console.log(i)
      embedInput[i] = {}
      console.log(embedInput);
      for (let j in input[i]) {
        console.log(input[i][j]);
        embedInput[i][j] = input[i][j]
      }
    }
    //console.log(JSON.stringify(embedInput));
    $("#embedcode").html(
      "&lt;div class='quiz-container'></div>&lt;script type='text/javascript'>window.jQuery || document.write(\"&lt;script src='//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js'>&lt;&#92;/script>\");&lt;/script>&lt;script type='text/javascript'>var input = " +
        JSON.stringify(embedInput) +
        "; var pubStylesheet = '" +
        pubStylesheet +
        "'; var pub = '" +
        pub +
        "'; &lt;/script>&lt;script src='http://assets.sbnation.com.s3.amazonaws.com/features/quiz-generator/" +
        quizType +
        ".js'>&lt;/script>"
    );
    // $("#embedcode").html("&lt;div class='quiz-container'></div>&lt;script type='text/javascript'>window.jQuery || document.write('&lt;script src='//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js'>&lt;&#92;/script>');&lt;/script>&lt;script type='text/javascript'>var input = " + JSON.stringify(input) + "; var pubStylesheet = '" + pubStylesheet + "';&lt;/script>&lt;script src='/javascripts/" + quizType + ".js'>&lt;/script>");
    addJS();
  }

  function buildquiz() {
    console.log("1. BUILD QUIZ");
    url = $("#url").val();
    init();
    getStylesheet();
  }

  function buildflowchart() {
    url = $("#url").val();
    init();
    getStylesheet();
  }

  $(document).ready(function () {
    $("input:radio[name=quiz-type]").click(function () {
      quizType = $("input:radio[name=quiz-type]:checked").val();
      changeTemplate();
    });

    $("#build").on("click", function () {
      quizType = $("input:radio[name=quiz-type]:checked").val();
      changeTemplate();
      if (quizType != undefined) {
        submitquiz();
      } else {
        alert("Please choose a quiz type at the top of the page!");
      }
    });
  });
})(jQuery);
